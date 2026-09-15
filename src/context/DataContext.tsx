import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { localStore, nowIso, uid } from '../lib/localStore';
import { cancelReminder } from '../lib/notifications';
import { todayKey } from '../utils/dates';
import { secureRandomToken } from '../lib/tokens';
import type {
  CareAction,
  CareActionKind,
  CareCard,
  HealthEntry,
  HealthKind,
  Invitation,
  JournalEntry,
  Pet,
  PetMember,
  PetRole,
  WeightEntry,
} from '../types';

// --- Zod schemas for Supabase boundary validation ---
// The Supabase client here is untyped (`SupabaseClient` without a `Database` generic), so every row
// that comes back from `.select()` / `.insert()` is `any`. We validate at the boundary so a database
// row that drifts away from the TypeScript interface fails loudly here instead of being silently
// `as`--cast and crashing a downstream consumer.
// Numeric columns may arrive as strings for Postgres `numeric`/`decimal` types, so coerce them.

const emailSchema = z.string().email().transform((e) => e.toLowerCase());

function normalizeEmail(raw: string | null): string | null {
  // Validate with Zod before ever embedding the value in a query. A malformed email is
  // rejected (returns null) rather than being pushed through to Supabase.
  if (!raw) return null;
  const parsed = emailSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const speciesSchema = z.enum([
  'dog',
  'cat',
  'bird',
  'fish',
  'rabbit',
  'hamster',
  'turtle',
  'lizard',
  'snake',
  'horse',
  'hedgehog',
  'other',
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
  weight_kg: z.coerce.number().nullable(),
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

const weightEntrySchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  weighed_on: z.string(),
  weight_kg: z.coerce.number(),
  created_at: z.string(),
});

const journalEntrySchema = z.object({
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

const healthEntrySchema = z.object({
  id: z.string(),
  pet_id: z.string(),
  kind: healthKindSchema,
  title: z.string(),
  occurred_on: z.string(),
  weight_kg: z.coerce.number().nullable(),
  note: z.string(),
  cost: z.coerce.number().nullable(),
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

interface DataCtx {
  ready: boolean;
  cloud: boolean;
  error: string | null;
  pets: Pet[];
  activePetId: string | null;
  activePet: Pet | null;
  setActivePetId: (id: string | null) => void;
  journal: JournalEntry[];
  weights: WeightEntry[];
  health: HealthEntry[];
  careActions: CareAction[];
  careCards: CareCard[];
  members: PetMember[];
  invitations: Invitation[];
  myRoleByPet: Record<string, PetRole>;
  reload: () => Promise<void>;
  // pets
  createPet: (input: Partial<Pet>) => Promise<Pet>;
  updatePet: (id: string, patch: Partial<Pet>) => Promise<void>;
  deletePet: (id: string) => Promise<void>;
  addWeight: (petId: string, weightKg: number, date?: string) => Promise<void>;
  // journal
  createJournal: (input: Partial<JournalEntry> & { pet_id: string }) => Promise<JournalEntry>;
  updateJournal: (id: string, patch: Partial<JournalEntry>) => Promise<void>;
  deleteJournal: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  // health
  createHealth: (input: Partial<HealthEntry> & { pet_id: string; kind: HealthKind }) => Promise<HealthEntry>;
  updateHealth: (id: string, patch: Partial<HealthEntry>) => Promise<void>;
  deleteHealth: (id: string) => Promise<void>;
  // care checklist
  logCareAction: (petId: string, kind: CareActionKind, by: string, byLabel: string, note?: string) => Promise<void>;
  // care cards
  createCareCard: (petId: string, label: string, payload: Record<string, string>, expiresAt: string | null) => Promise<CareCard>;
  revokeCareCard: (id: string) => Promise<void>;
  // family
  inviteMember: (petId: string, email: string, role: PetRole) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
}

const Ctx = createContext<DataCtx | undefined>(undefined);

function ns(userId: string, key: string) {
  return `data.${userId}.${key}`;
}

async function readLocal<T>(userId: string, key: string, fallback: T): Promise<T> {
  return localStore.read<T>(ns(userId, key), fallback);
}

export function DataProvider({
  children,
  userId,
  userEmail,
}: {
  children: React.ReactNode;
  userId: string | null;
  userEmail: string | null;
}) {
  const cloud = isSupabaseConfigured && !!userId;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [health, setHealth] = useState<HealthEntry[]>([]);
  const [careActions, setCareActions] = useState<CareAction[]>([]);
  const [careCards, setCareCards] = useState<CareCard[]>([]);
  const [members, setMembers] = useState<PetMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myRoleByPet, setMyRoleByPet] = useState<Record<string, PetRole>>({});

  const reload = useCallback(async () => {
    setReady(false);
    if (!userId) {
      setPets([]);
      setJournal([]);
      setWeights([]);
      setHealth([]);
      setCareActions([]);
      setCareCards([]);
      setMembers([]);
      setInvitations([]);
      setMyRoleByPet({});
      setReady(true);
      return;
    }
    setError(null);
    try {
      if (cloud) {
        const sb = getSupabase()!;
        const { data: owned, error: e1 } = await sb.from('pets').select('*').eq('owner_id', userId).order('created_at');
        if (e1) throw e1;
        let memberPetIds: string[] = [];
        let myMembers: PetMember[] = [];
        // Validate userEmail with Zod before it touches the query filter; the parametrized `.eq()`
        // builder already prevents SQL/PostgREST injection, and a normalized (lowercased) valid email
        // is what we hand to Supabase.
        const emailFilter = normalizeEmail(userEmail);
        if (emailFilter) {
          const [byUser, byEmail] = await Promise.all([
            sb.from('pet_members').select('*').eq('user_id', userId),
            sb.from('pet_members').select('*').eq('email', emailFilter),
          ]);
          if (byUser.error) throw byUser.error;
          if (byEmail.error) throw byEmail.error;
          const combined = [...(byUser.data ?? []), ...(byEmail.data ?? [])];
          myMembers = petMemberSchema.array().parse(combined);
          myMembers = Array.from(new Map(myMembers.map((m) => [m.id, m])).values());
          memberPetIds = [...new Set(myMembers.map((m) => m.pet_id))];
        }
        let shared: Pet[] = [];
        if (memberPetIds.length) {
          const { data, error: sharedError } = await sb.from('pets').select('*').in('id', memberPetIds);
          if (sharedError) throw sharedError;
          shared = petSchema.array().parse(data ?? []);
        }
        const merged = [...petSchema.array().parse(owned ?? []), ...shared];
        const dedup = Array.from(new Map(merged.map((p) => [p.id, p])).values());
        setPets(dedup);
        const roles: Record<string, PetRole> = {};
        dedup.forEach((p) => {
          roles[p.id] = p.owner_id === userId ? 'owner' : (myMembers.find((m) => m.pet_id === p.id)?.role ?? 'viewer');
        });
        setMyRoleByPet(roles);
        const ids = dedup.map((p) => p.id);
        if (!ids.length) {
          setJournal([]); setWeights([]); setHealth([]);
          setCareActions([]); setCareCards([]); setMembers([]); setInvitations([]);
        } else {
          const [j, w, h, ca, cc, mm, inv] = await Promise.all([
            sb.from('journal_entries').select('*').in('pet_id', ids).order('taken_at', { ascending: false }).limit(500),
            sb.from('weight_entries').select('*').in('pet_id', ids).order('weighed_on', { ascending: false }).limit(500),
            sb.from('health_entries').select('*').in('pet_id', ids).order('occurred_on', { ascending: false }).limit(500),
            sb.from('care_actions').select('*').in('pet_id', ids).order('done_at', { ascending: false }).limit(200),
            sb.from('care_cards').select('*').in('pet_id', ids).order('created_at', { ascending: false }).limit(100),
            sb.from('pet_members').select('*').in('pet_id', ids),
            sb.from('invitations').select('*').in('pet_id', ids).order('created_at', { ascending: false }),
          ]);
          for (const result of [j, w, h, ca, cc, mm, inv]) {
            if (result.error) throw result.error;
          }
          setJournal(journalEntrySchema.array().parse(j.data ?? []));
          setWeights(weightEntrySchema.array().parse(w.data ?? []));
          setHealth(healthEntrySchema.array().parse(h.data ?? []));
          setCareActions(careActionSchema.array().parse(ca.data ?? []));
          setCareCards(careCardSchema.array().parse(cc.data ?? []));
          setMembers(petMemberSchema.array().parse(mm.data ?? []));
          setInvitations(invitationSchema.array().parse(inv.data ?? []));
        }
      } else {
        const [lp, lj, lw, lh, la, lc, lm, li] = await Promise.all([
          readLocal<Pet[]>(userId, 'pets', []),
          readLocal<JournalEntry[]>(userId, 'journal', []),
          readLocal<WeightEntry[]>(userId, 'weights', []),
          readLocal<HealthEntry[]>(userId, 'health', []),
          readLocal<CareAction[]>(userId, 'actions', []),
          readLocal<CareCard[]>(userId, 'cards', []),
          readLocal<PetMember[]>(userId, 'members', []),
          readLocal<Invitation[]>(userId, 'invites', []),
        ]);
        setPets(lp);
        setJournal([...lj].sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1)));
        setWeights(lw);
        setHealth(lh);
        setCareActions(la);
        setCareCards(lc);
        setMembers(lm);
        setInvitations(li);
        const roles: Record<string, PetRole> = {};
        lp.forEach((p) => {
          roles[p.id] = 'owner';
        });
        setMyRoleByPet(roles);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your pets.');
    } finally {
      setReady(true);
    }
  }, [userId, userEmail, cloud]);

  useEffect(() => {
    // Initial + user-change data load from external systems (Supabase / AsyncStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  // Derived selection: first pet wins when nothing (or a deleted pet) is selected.
  // No effect needed — selection resolves during render.

  const persistLocal = useCallback(async (userId: string) => {
    // best-effort mirror of in-memory state
    await Promise.all([
      localStore.write(ns(userId, 'pets'), pets),
      localStore.write(ns(userId, 'journal'), journal),
      localStore.write(ns(userId, 'weights'), weights),
      localStore.write(ns(userId, 'health'), health),
      localStore.write(ns(userId, 'actions'), careActions),
      localStore.write(ns(userId, 'cards'), careCards),
      localStore.write(ns(userId, 'members'), members),
      localStore.write(ns(userId, 'invites'), invitations),
    ]);
  }, [pets, journal, weights, health, careActions, careCards, members, invitations]);

  // Keep local mirror fresh (offline mode reads it on next launch)
  useEffect(() => {
    if (!userId || cloud) return;
    persistLocal(userId).catch(() => {});
  }, [persistLocal, userId, cloud]);

  const value = useMemo<DataCtx>(() => {
    const resolvedId = activePetId && pets.some((p) => p.id === activePetId) ? activePetId : (pets[0]?.id ?? null);
    const activePet = pets.find((p) => p.id === resolvedId) ?? null;
    return {
      ready, cloud, error, pets, activePetId: resolvedId, activePet, setActivePetId,
      journal, weights, health, careActions, careCards, members, invitations, myRoleByPet, reload,

      createPet: async (input) => {
        if (!userId) throw new Error('Not signed in.');
        const row: Pet = {
          id: uid('pet'),
          owner_id: userId,
          name: (input.name ?? '').trim(),
          species: (input.species as Pet['species']) ?? 'dog',
          breed: (input.breed ?? '').trim(),
          photo_url: input.photo_url ?? null,
          birth_date: input.birth_date ?? null,
          weight_kg: input.weight_kg ?? null,
          allergies: input.allergies ?? '',
          conditions: input.conditions ?? '',
          vet_name: input.vet_name ?? '',
          vet_phone: input.vet_phone ?? '',
          emergency_contact: input.emergency_contact ?? '',
          feeding_notes: input.feeding_notes ?? '',
          care_notes: input.care_notes ?? '',
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        if (cloud) {
          const { data, error: err } = await getSupabase()!.from('pets').insert(row).select().single();
          if (err) throw new Error(err.message);
          const created = petSchema.parse(data);
          setPets((p) => [...p, created]);
          setActivePetId(created.id);
          return created;
        }
        setPets((p) => [...p, row]);
        setActivePetId(row.id);
        return row;
      },

      updatePet: async (id, patch) => {
        const next = { ...patch, updated_at: nowIso() } as Partial<Pet>;
        if (cloud) {
          const { error: err } = await getSupabase()!.from('pets').update(next).eq('id', id);
          if (err) throw new Error(err.message);
        }
        setPets((prev) => prev.map((p) => (p.id === id ? { ...p, ...next } as Pet : p)));
        if (typeof patch.weight_kg === 'number' && patch.weight_kg > 0) {
          await value.addWeight(id, patch.weight_kg);
        }
      },

      deletePet: async (id) => {
        if (cloud) {
          const sb = getSupabase()!;
          const { error: err } = await sb.from('pets').delete().eq('id', id);
          if (err) throw new Error(err.message);
          const cleanup = await Promise.all([
            sb.from('journal_entries').delete().eq('pet_id', id),
            sb.from('health_entries').delete().eq('pet_id', id),
            sb.from('weight_entries').delete().eq('pet_id', id),
            sb.from('care_actions').delete().eq('pet_id', id),
            sb.from('care_cards').delete().eq('pet_id', id),
            sb.from('pet_members').delete().eq('pet_id', id),
            sb.from('invitations').delete().eq('pet_id', id),
          ]);
          for (const r of cleanup) {
            if (r.error) throw new Error(r.error.message);
          }
        }
        setPets((prev) => prev.filter((p) => p.id !== id));
        setJournal((prev) => prev.filter((j) => j.pet_id !== id));
        setHealth((prev) => prev.filter((h) => h.pet_id !== id));
        setWeights((prev) => prev.filter((w) => w.pet_id !== id));
        setCareActions((prev) => prev.filter((c) => c.pet_id !== id));
        setCareCards((prev) => prev.filter((c) => c.pet_id !== id));
        setMembers((prev) => prev.filter((m) => m.pet_id !== id));
        setInvitations((prev) => prev.filter((i) => i.pet_id !== id));
      },

      addWeight: async (petId, weightKg, date) => {
        const row: WeightEntry = {
          id: uid('w'), pet_id: petId,
          weighed_on: date ?? todayKey(),
          weight_kg: weightKg, created_at: nowIso(),
        };
        if (cloud) {
          const { error: err } = await getSupabase()!.from('weight_entries').insert(row);
          if (err) throw new Error(err.message);
        }
        setWeights((prev) => [row, ...prev]);
      },

      createJournal: async (input) => {
        if (!userId) throw new Error('Not signed in.');
        const row: JournalEntry = {
          id: uid('j'), pet_id: input.pet_id, author_id: userId,
          note: (input.note ?? '').slice(0, 280),
          photo_url: input.photo_url ?? null,
          taken_at: input.taken_at ?? nowIso(),
          location_label: input.location_label ?? null,
          weather_label: input.weather_label ?? null,
          favorite: input.favorite ?? false,
          created_at: nowIso(),
        };
        if (cloud) {
          const { data, error: err } = await getSupabase()!.from('journal_entries').insert(row).select().single();
          if (err) throw new Error(err.message);
          const created = journalEntrySchema.parse(data);
          setJournal((prev) => [created, ...prev]);
          return created;
        }
        setJournal((prev) => [row, ...prev]);
        return row;
      },

      updateJournal: async (id, patch) => {
        const safe = { ...patch } as Partial<JournalEntry>;
        if (typeof safe.note === 'string') safe.note = safe.note.slice(0, 280);
        if (cloud) {
          const { error: err } = await getSupabase()!.from('journal_entries').update(safe).eq('id', id);
          if (err) throw new Error(err.message);
        }
        setJournal((prev) => prev.map((j) => (j.id === id ? { ...j, ...safe } as JournalEntry : j)));
      },

      deleteJournal: async (id) => {
        if (cloud) {
          const { error: err } = await getSupabase()!.from('journal_entries').delete().eq('id', id);
          if (err) throw new Error(err.message);
        }
        setJournal((prev) => prev.filter((j) => j.id !== id));
      },

      toggleFavorite: async (id) => {
        const cur = journal.find((j) => j.id === id);
        if (!cur) return;
        await value.updateJournal(id, { favorite: !cur.favorite });
      },

      createHealth: async (input) => {
        const row: HealthEntry = {
          id: uid('h'), pet_id: input.pet_id, kind: input.kind,
          title: (input.title ?? '').trim() || 'Entry',
          occurred_on: input.occurred_on ?? todayKey(),
          weight_kg: input.weight_kg ?? null,
          note: input.note ?? '',
          cost: input.cost ?? null,
          next_due_on: input.next_due_on ?? null,
          dosage: input.dosage ?? null,
          schedule: input.schedule ?? null,
          ends_on: input.ends_on ?? null,
          remind: input.remind ?? false,
          notification_id: input.notification_id ?? null,
          photo_url: input.photo_url ?? null,
          created_at: nowIso(),
        };
        if (cloud) {
          const { data, error: err } = await getSupabase()!.from('health_entries').insert(row).select().single();
          if (err) throw new Error(err.message);
          const created = healthEntrySchema.parse(data);
          setHealth((prev) => [created, ...prev]);
          return created;
        }
        setHealth((prev) => [row, ...prev]);
        return row;
      },

      updateHealth: async (id, patch) => {
        const entry = health.find((h) => h.id === id);
        if (entry?.notification_id) {
          const newKind = patch.kind ?? entry.kind;
          const newRemind = patch.remind ?? entry.remind;
          if (newKind !== 'medication' || !newRemind) {
            await cancelReminder(entry.notification_id);
            patch = { ...patch, notification_id: null };
          }
        }
        if (cloud) {
          const { error: err } = await getSupabase()!.from('health_entries').update(patch).eq('id', id);
          if (err) throw new Error(err.message);
        }
        setHealth((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } as HealthEntry : h)));
      },

      deleteHealth: async (id) => {
        const entry = health.find((h) => h.id === id);
        if (entry?.notification_id) {
          await cancelReminder(entry.notification_id);
        }
        if (cloud) {
          const { error: err } = await getSupabase()!.from('health_entries').delete().eq('id', id);
          if (err) throw new Error(err.message);
        }
        setHealth((prev) => prev.filter((h) => h.id !== id));
      },

      logCareAction: async (petId, kind, by, byLabel, note) => {
        const row: CareAction = {
          id: uid('c'), pet_id: petId, kind, done_by: by,
          done_by_label: byLabel, done_at: nowIso(), note: note ?? null,
        };
        if (cloud) {
          const { error: err } = await getSupabase()!.from('care_actions').insert(row);
          if (err) throw new Error(err.message);
        }
        setCareActions((prev) => [row, ...prev]);
      },

      createCareCard: async (petId, label, payload, expiresAt) => {
        const token = await secureRandomToken();
        const row: CareCard = {
          id: uid('card'), pet_id: petId, token,
          label: label.trim() || 'Care card',
          payload, expires_at: expiresAt, revoked: false, created_at: nowIso(),
        };
        if (cloud) {
          const { data, error: err } = await getSupabase()!.from('care_cards').insert(row).select().single();
          if (err) throw new Error(err.message);
          const created = careCardSchema.parse(data);
          setCareCards((prev) => [created, ...prev]);
          return created;
        }
        setCareCards((prev) => [row, ...prev]);
        return row;
      },

      revokeCareCard: async (id) => {
        if (cloud) {
          const { error: err } = await getSupabase()!.from('care_cards').update({ revoked: true }).eq('id', id);
          if (err) throw new Error(err.message);
        }
        setCareCards((prev) => prev.map((c) => (c.id === id ? { ...c, revoked: true } : c)));
      },

      inviteMember: async (petId, email, role) => {
        const clean = email.trim().toLowerCase();
        const token = await secureRandomToken();
        const row: Invitation = {
          id: uid('inv'), pet_id: petId, email: clean, role,
          token, accepted: false, created_at: nowIso(),
        };
        if (cloud) {
          const sb = getSupabase()!;
          const { error: err } = await sb.from('invitations').insert(row);
          if (err) throw new Error(err.message);
          // Also create a pending member row so RLS grants read once they sign up with that email.
          const { error: memberError } = await sb.from('pet_members').insert({
            id: uid('mem'), pet_id: petId, user_id: null, email: clean, role, created_at: nowIso(),
          });
          if (memberError) {
            await sb.from('invitations').delete().eq('id', row.id);
            throw new Error(memberError.message);
          }
        } else {
          setMembers((prev) => [
            ...prev,
            { id: uid('mem'), pet_id: petId, user_id: null, email: clean, role, created_at: nowIso() },
          ]);
        }
        setInvitations((prev) => [row, ...prev]);
      },

      removeMember: async (id) => {
        if (cloud) {
          const { error: err } = await getSupabase()!.from('pet_members').delete().eq('id', id);
          if (err) throw new Error(err.message);
        }
        setMembers((prev) => prev.filter((m) => m.id !== id));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, error, pets, activePetId, journal, weights, health, careActions, careCards, members, invitations, myRoleByPet, cloud, userId, userEmail]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useData() must be used within a <DataProvider>.');
  }
  return ctx;
}
