import * as ImagePicker from 'expo-image-picker';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { makeStorageUri, parseStorageUri } from './storagePaths';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export async function pickImage(allowsEditing = true): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo access was denied. You can still write notes without photos — enable access in Settings anytime.');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

export async function takePhoto(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Camera access was denied. You can still pick an existing photo instead.');
  }
  const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}

function extFromUri(uri: string): string {
  const m = uri.toLowerCase().match(/\.([a-z0-9]+)(\?|$)/);
  return m ? m[1] : 'jpg';
}

/** Upload to Supabase Storage when configured; otherwise return the local uri. */
export async function uploadPetImage(userId: string, kind: 'pets' | 'journal' | 'docs', uri: string): Promise<string> {
  if (!isSupabaseConfigured) return uri;
  try {
    const sb = getSupabase()!;
    const res = await fetch(uri);
    const blob = await res.blob();
    const ext = extFromUri(uri);
    const path = `${userId}/${kind}/${Date.now()}.${ext}`;
    const bucket = kind === 'docs' ? 'documents' : 'pet-images';
    const { error } = await sb.storage.from(bucket).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;
    return makeStorageUri(bucket, path);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown upload error';
    throw new Error(`Photo upload failed. Check your connection and try again. ${detail}`);
  }
}

export async function resolveStoredImageUri(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  const location = parseStorageUri(uri);
  if (!location) return uri;
  const sb = getSupabase();
  if (!sb) throw new Error('Cloud storage is not configured.');
  const { data, error } = await sb.storage.from(location.bucket).createSignedUrl(location.path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open this private image.');
  return data.signedUrl;
}
