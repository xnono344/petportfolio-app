import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAvailableAsync } from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { secureGet, secureSet, secureRemove } from './secureStore';

const PREFIX = 'pp.local.';

// Zod schemas describing each shape persisted via localStore. Parsed values
// are validated at the storage boundary, so a corrupted or schema-evolved
// stored record is caught here and degrades gracefully to the fallback
// instead of being blindly cast to T (and later crashing a consumer).
const speciesSchema = z.enum([
  'dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'turtle', 'lizard',
  'snake', 'horse', 'hedgehog', 'other',
]);
const petRoleSchema = z.enum(['owner', 'viewer', 'carer']);
const healthKindSchema = z.enum(['vet_visit', 'vaccination', 'medication', 'emergency']);
const careActionKindSchema = z.enum(['fed', 'walked', 'meds']);

const petSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  name: z.string(),
  species: speciesSchema,
  breed: z.string(),
  photo_url: z.string().nullable(),
  birth_date: z.string().nullable(),
  weight_kg: z.number().nullable(),
  allergies: z.string(),
  conditions: z.string(),
  vet_name: z.string(),
  vet_phone: z.string(),
  emergency_contact: z.string(),
  feeding_notes: z.string(),
  care_notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const weightSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  weighed_on: z.string(),
  weight_kg: z.number(),
  created_at: z.string(),
});

const journalSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  author_id: z.string(),
  note: z.string(),
  photo_url: z.string().nullable(),
  taken_at: z.string(),
  location_label: z.string().nullable(),
  weather_label: z.string().nullable(),
  favorite: z.boolean(),
  created_at: z.string(),
});

const healthSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  kind: healthKindSchema,
  title: z.string(),
  occurred_on: z.string(),
  weight_kg: z.number().nullable(),
  note: z.string(),
  cost: z.number().nullable(),
  next_due_on: z.string().nullable(),
  dosage: z.string().nullable(),
  schedule: z.string().nullable(),
  ends_on: z.string().nullable(),
  remind: z.boolean(),
  notification_id: z.string().nullable(),
  photo_url: z.string().nullable(),
  created_at: z.string(),
});

const careActionSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  kind: careActionKindSchema,
  done_by: z.string(),
  done_by_label: z.string(),
  done_at: z.string(),
  note: z.string().nullable(),
});

const careCardSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  token: z.string(),
  label: z.string(),
  payload: z.record(z.string()),
  expires_at: z.string().nullable(),
  revoked: z.boolean(),
  created_at: z.string(),
});

const petMemberSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  user_id: z.string().nullable(),
  email: z.string(),
  role: petRoleSchema,
  created_at: z.string(),
});

const invitationSchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  email: z.string(),
  role: petRoleSchema,
  token: z.string(),
  accepted: z.boolean(),
  created_at: z.string(),
});

export const appUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
});

// Exported so callers (and tests) can validate remote payloads with the same
// schemas used for the local cache, e.g. `petArraySchema.parse(data)`.
export const petArraySchema = z.array(petSchema);
export const weightArraySchema = z.array(weightSchema);
export const journalArraySchema = z.array(journalSchema);
export const healthArraySchema = z.array(healthSchema);
export const careActionArraySchema = z.array(careActionSchema);
export const careCardArraySchema = z.array(careCardSchema);
export const petMemberArraySchema = z.array(petMemberSchema);
export const invitationArraySchema = z.array(invitationSchema);

// Maps the entity segment of a namespaced key to its validating schema.
// Stored keys look like `data.<userId>.<entity>` (arrays) or `auth.user`.
const SCHEMA_BY_ENTITY: Record<string, z.ZodType<unknown>> = {
  pets: petArraySchema,
  journal: journalArraySchema,
  weights: weightArraySchema,
  health: healthArraySchema,
  actions: careActionArraySchema,
  cards: careCardArraySchema,
  members: petMemberArraySchema,
  invites: invitationArraySchema,
};

function schemaForKey(key: string): z.ZodType<unknown> | undefined {
  if (key === 'auth.user') return appUserSchema;
  if (key.startsWith('data.')) {
    const entity = key.split('.').pop();
    return entity ? SCHEMA_BY_ENTITY[entity] : undefined;
  }
  return undefined;
}

/**
 * Entities whose persisted form contains sensitive PII / PHI / bearer
 * credentials (veterinary phone numbers, emergency contacts, health
 * conditions, medication schedules, care-card & invitation tokens, and the
 * locally cached user identity). These MUST never be written to AsyncStorage in
 * cleartext: each is AES-256-GCM encrypted with a master key that lives in
 * expo-SecureStore (iOS Keychain / Android Keystore) and the ciphertext is what
 * AsyncStorage holds. Non-sensitive entities (only `weights` currently) stay in
 * plain AsyncStorage — they hold no identifying or credential data.
 */
const SENSITIVE_ENTITIES: ReadonlySet<string> = new Set([
  'pets',
  'health',
  'cards',
  'invites',
  'journal',
  'members',
  'auth.user',
]);

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_ENTITIES.has(key)) return true;
  if (key.startsWith('data.')) {
    const entity = key.split('.').pop();
    return entity != null && SENSITIVE_ENTITIES.has(entity);
  }
  return false;
}

// --- AES-256-GCM at-rest encryption ------------------------------------------
//
// Why AsyncStorage + expo-crypto instead of storing the values directly in
// expo-SecureStore? SecureStore holds a single value as one OS keychain/
// keystore entry; iOS caps a keychain item's `kSecValueData` at roughly 4 KB,
// so persisting a multi-hundred-entry `journal`/`health`/`cards` array in
// SecureStore would throw and, because the cache is best-effort, silently lose
// the data on iOS. expo-SecureStore is still the right home for the small
// symmetric key; expo-crypto then encrypts the (potentially large) JSON blob
// before it touches AsyncStorage. See security.md for the threat model.

const KEY_ALIAS = `${PREFIX}enc_key`;

type AesKey = Crypto.AESEncryptionKey;

let cachedKey: AesKey | null = null;
let keyPromise: Promise<AesKey | null> | null = null;
let secureAvailableCache: boolean | null = null;

async function secureAvailable(): Promise<boolean> {
  if (secureAvailableCache !== null) return secureAvailableCache;
  try {
    secureAvailableCache = await isAvailableAsync();
  } catch {
    secureAvailableCache = false;
  }
  return secureAvailableCache;
}

async function createKey(): Promise<AesKey> {
  if (await secureAvailable()) {
    // Native: protect the master key with the OS Keychain / Android Keystore.
    const encoded = await secureGet(KEY_ALIAS);
    if (encoded) {
      return (await Crypto.AESEncryptionKey.import(encoded, 'base64')) as AesKey;
    }
    const key = (await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256)) as AesKey;
    await secureSet(KEY_ALIAS, await key.encoded('base64'));
    return key;
  }
  // No OS keychain available (web): derive a per-install random key persisted in
  // AsyncStorage. This still keeps sensitive values out of cleartext at rest
  // (guarding against storage-file inspection) but cannot defend against
  // script/XSS access, which is the relevant web threat model.
  const encoded = await AsyncStorage.getItem(KEY_ALIAS);
  if (encoded) {
    return (await Crypto.AESEncryptionKey.import(encoded, 'base64')) as AesKey;
  }
  const key = (await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256)) as AesKey;
  await AsyncStorage.setItem(KEY_ALIAS, await key.encoded('base64'));
  return key;
}

// Single-flight key creation: concurrent reads (DataContext fires them in a
// `Promise.all`) share one generation call and therefore one key, so blobs are
// always decryptable. A failed creation is not cached, allowing a retry.
function getKey(): Promise<AesKey | null> {
  if (cachedKey !== null) return Promise.resolve(cachedKey);
  if (keyPromise !== null) return keyPromise;
  keyPromise = createKey().then((k) => {
    cachedKey = k;
    return k;
  });
  void keyPromise.catch(() => null).then(() => {
    keyPromise = null;
  });
  return keyPromise;
}

// Minimal, dependency-free UTF-8 <-> bytes conversion. We cannot rely on the
// global `TextEncoder`/`TextDecoder` (not provided by Hermes/RN here) or on
// `btoa`/`atob` (removed from RN's global scope), and expo-crypto's AES API
// takes and returns raw bytes.
function encodeUtf8(str: string): Uint8Array {
  const pct = encodeURIComponent(str);
  const out = new Uint8Array(pct.length);
  let j = 0;
  for (let i = 0; i < pct.length; i++) {
    const c = pct.charCodeAt(i);
    if (c === 37 /* '%' */) {
      out[j++] = parseInt(pct.substr(i + 1, 2), 16);
      i += 2;
    } else {
      out[j++] = c;
    }
  }
  return out.subarray(0, j);
}

function decodeUtf8(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    parts.push(b < 0x80 ? String.fromCharCode(b) : '%' + b.toString(16).padStart(2, '0').toUpperCase());
  }
  return decodeURIComponent(parts.join(''));
}

// Distinguish a stored value without decrypting: an AES-GCM sealed blob is
// persisted as base64 (chars A-Za-z0-9+/=), never starting with a JSON token
// char. Plaintext records are always JSON arrays (`[`) or objects (`{`), so the
// first byte unambiguously separates the two forms.
function looksEncrypted(raw: string): boolean {
  if (raw.length === 0) return false;
  const first = raw.charCodeAt(0);
  return first !== 0x5b /* [ */ && first !== 0x7b /* { */;
}

async function encrypt(plaintext: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  try {
    const sealed = await Crypto.aesEncryptAsync(encodeUtf8(plaintext), key);
    return sealed.combined('base64');
  } catch {
    return null;
  }
}

async function decrypt(blob: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  try {
    const sealed = Crypto.AESSealedData.fromCombined(blob);
    const bytes = (await Crypto.aesDecryptAsync(sealed, key)) as Uint8Array;
    return decodeUtf8(bytes);
  } catch {
    return null;
  }
}

// Reads a value that was written under the SecureStore-backed layout used by an
// earlier build (everything-in-SecureStore). Guarded so it is a no-op on web,
// where SecureStore is unavailable.
async function readSecure(key: string): Promise<string | null> {
  if (!(await secureAvailable())) return null;
  try {
    return await secureGet(key);
  } catch {
    return null;
  }
}

// Encrypts `plaintext` and persists it to AsyncStorage. Returns false (leaving
// storage untouched) when encryption is unavailable so the caller can avoid
// writing anything and never downgrade a sensitive value to cleartext.
async function persistEncrypted(storageKey: string, plaintext: string): Promise<boolean> {
  const encrypted = await encrypt(plaintext);
  if (encrypted === null) return false;
  await AsyncStorage.setItem(storageKey, encrypted);
  return true;
}

// Resolves the cleartext JSON string for a key, transparently upgrading legacy
// on-disk formats into the current encrypted-AsyncStorage layout:
//   1. encrypted AES blob in AsyncStorage (current) -> decrypt
//   2. legacy plaintext JSON in AsyncStorage (original bug) -> re-encrypt in place
//   3. legacy plaintext in SecureStore (prior build) -> re-home + delete
async function loadValue(key: string): Promise<string | null> {
  const storageKey = PREFIX + key;
  const sensitive = isSensitiveKey(key);

  const raw = await AsyncStorage.getItem(storageKey);
  if (raw !== null) {
    if (sensitive && looksEncrypted(raw)) return decrypt(raw);
    if (sensitive) {
      // Legacy plaintext in AsyncStorage: purge it by re-encrypting in place.
      await persistEncrypted(storageKey, raw);
    }
    return raw;
  }

  // AsyncStorage miss: recover from a legacy SecureStore copy.
  const legacy = await readSecure(storageKey);
  if (legacy === null) return null;

  try {
    if (sensitive) {
      const migrated = await persistEncrypted(storageKey, legacy);
      if (migrated) {
        await secureRemove(storageKey);
      } else {
        // Encryption unavailable: keep the SecureStore copy so the data is not
        // lost rather than writing it as plaintext into AsyncStorage.
        return legacy;
      }
    } else {
      await AsyncStorage.setItem(storageKey, legacy);
      await secureRemove(storageKey);
    }
  } catch {
    // Migration is best-effort; the recovered plaintext is still returned so the
    // caller gets the data this read even if the cleanup write failed.
  }
  return legacy;
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await loadValue(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    const schema = schemaForKey(key);
    if (schema) {
      // Validate at the boundary: corrupted/schema-drifted stored values throw
      // and fall through to the fallback instead of surfacing as T unchecked.
      return schema.parse(parsed) as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    const storageKey = PREFIX + key;
    if (isSensitiveKey(key)) {
      const encrypted = await encrypt(JSON.stringify(value));
      if (encrypted !== null) {
        await AsyncStorage.setItem(storageKey, encrypted);
      }
      // If encryption is unavailable we intentionally do NOT fall back to
      // plaintext: persisting care-card tokens / vet contacts in cleartext would
      // reintroduce the bug being fixed. The local cache is best-effort.
      return;
    }
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // local cache is best-effort
  }
}

async function remove(key: string): Promise<void> {
  const storageKey = PREFIX + key;
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch {
    // best-effort
  }
  if (await secureAvailable()) {
    try {
      await secureRemove(storageKey);
    } catch {
      // best-effort
    }
  }
}

export const localStore = { read, write, remove };

const USER_CACHE_ENTITIES = [
  'pets',
  'journal',
  'weights',
  'health',
  'actions',
  'cards',
  'members',
  'invites',
] as const;

/**
 * Wipe the currently-signed-in user's local cache (the offline mirror written
 * by DataContext) plus the locally-persisted offline identity, and sweep any
 * legacy `pp.local.*` AsyncStorage entries that were never migrated.
 */
export async function clearUserCache(userId: string): Promise<void> {
  const keys = ['auth.user', ...USER_CACHE_ENTITIES.map((e) => `data.${userId}.${e}`)];
  await Promise.all(keys.map(remove)).catch(() => undefined);
  // Best-effort safety net: catch any legacy `pp.local.*` AsyncStorage entries
  // (original plaintext cache or unmigrated blobs). Never remove the app-wide
  // AES master key (`pp.local.enc_key`); it must outlive a single user's cache.
  try {
    const legacy = await AsyncStorage.getAllKeys();
    const ours = legacy.filter((k) => k.startsWith(PREFIX) && k !== KEY_ALIAS);
    await Promise.all(ours.map((k) => AsyncStorage.removeItem(k)));
  } catch {
    // ignore: best-effort
  }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
