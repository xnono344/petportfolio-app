// @ts-nocheck -- Supabase Edge Functions run on Deno, outside the Expo TS runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function envKey(name: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS', legacy: string): string {
  const encoded = Deno.env.get(name);
  if (encoded) {
    const parsed = JSON.parse(encoded);
    if (typeof parsed.default === 'string' && parsed.default) return parsed.default;
  }
  const fallback = Deno.env.get(legacy);
  if (!fallback) throw new Error(`Missing ${name}`);
  return fallback;
}

async function removeFolder(admin: ReturnType<typeof createClient>, bucket: string, folder: string) {
  const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) throw error;
  const paths = (data ?? []).filter((item) => item.id).map((item) => `${folder}/${item.name}`);
  if (!paths.length) return;
  const { error: removeError } = await admin.storage.from(bucket).remove(paths);
  if (removeError) throw removeError;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const url = Deno.env.get('SUPABASE_URL');
    if (!url) throw new Error('Missing SUPABASE_URL');
    const userClient = createClient(
      url,
      envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      url,
      envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );

    await Promise.all([
      removeFolder(admin, 'pet-images', `${user.id}/pets`),
      removeFolder(admin, 'pet-images', `${user.id}/journal`),
      removeFolder(admin, 'documents', `${user.id}/docs`),
    ]);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return Response.json({ deleted: true }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account deletion failed';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
