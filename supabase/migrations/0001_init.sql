-- PetPortfolio initial schema
-- Run with: supabase db push (or paste into the Supabase SQL editor).
-- IDs are client-generated text keys so offline-created rows sync cleanly.

create extension if not exists "pgcrypto";

-- ---------- tables ----------

create table if not exists public.pets (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'turtle', 'lizard', 'snake', 'horse', 'hedgehog', 'other')),
  breed text not null default '',
  photo_url text,
  birth_date date,
  weight_kg numeric,
  allergies text not null default '',
  conditions text not null default '',
  vet_name text not null default '',
  vet_phone text not null default '',
  emergency_contact text not null default '',
  feeding_notes text not null default '',
  care_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_entries (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  weighed_on date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  note varchar(280) not null default '',
  photo_url text,
  taken_at timestamptz not null default now(),
  location_label text,
  weather_label text,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.health_entries (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('vet_visit', 'vaccination', 'medication', 'emergency')),
  title text not null default 'Entry',
  occurred_on date not null default CURRENT_DATE,
  weight_kg numeric,
  note text not null default '',
  cost numeric,
  next_due_on date,
  dosage text,
  schedule text,
  ends_on date,
  remind boolean not null default false,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.care_actions (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('fed', 'walked', 'meds')),
  done_by text not null default '',
  done_by_label text not null default '',
  done_at timestamptz not null default now(),
  note text
);

create table if not exists public.care_cards (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  token text not null unique,
  label text not null default 'Care card',
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_members (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'viewer', 'carer')),
  created_at timestamptz not null default now(),
  unique (pet_id, email)
);

create table if not exists public.invitations (
  id text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'viewer', 'carer')),
  token text not null unique,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_pets_owner on public.pets (owner_id);
create index if not exists idx_journal_pet_time on public.journal_entries (pet_id, taken_at desc);
create index if not exists idx_health_pet_date on public.health_entries (pet_id, occurred_on desc);
create index if not exists idx_weights_pet on public.weight_entries (pet_id, weighed_on desc);
create index if not exists idx_actions_pet on public.care_actions (pet_id, done_at desc);
create index if not exists idx_members_pet on public.pet_members (pet_id);
create index if not exists idx_members_user on public.pet_members (user_id);
create index if not exists idx_cards_token on public.care_cards (token);

-- ---------- helpers ----------

create or replace function public.current_email()
returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'email', '')
$$;

-- Role of the calling user for a pet: 'owner' | 'viewer' | 'carer' | null
create or replace function public.pet_role(pid text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  r text;
begin
  select 'owner' into r from public.pets where id = pid and owner_id = auth.uid();
  if r is not null then return r; end if;
  select m.role into r from public.pet_members m
    where m.pet_id = pid and (m.user_id = auth.uid() or lower(m.email) = lower(coalesce(public.current_email(), '')))
    limit 1;
  return r;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pets_touch on public.pets;
create trigger trg_pets_touch before update on public.pets
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------

alter table public.pets enable row level security;
alter table public.weight_entries enable row level security;
alter table public.journal_entries enable row level security;
alter table public.health_entries enable row level security;
alter table public.care_actions enable row level security;
alter table public.care_cards enable row level security;
alter table public.pet_members enable row level security;
alter table public.invitations enable row level security;

-- pets
drop policy if exists pets_owner_all on public.pets;
create policy pets_owner_all on public.pets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists pets_member_read on public.pets;
create policy pets_member_read on public.pets for select to authenticated
  using (public.pet_role(id) is not null);

-- generic member-read for child tables
drop policy if exists weights_rw on public.weight_entries;
create policy weights_rw on public.weight_entries for all to authenticated
  using (public.pet_role(pet_id) = 'owner')
  with check (public.pet_role(pet_id) = 'owner');
drop policy if exists weights_read on public.weight_entries;
create policy weights_read on public.weight_entries for select to authenticated
  using (public.pet_role(pet_id) is not null);

-- journal: owner + carer write, everyone with access reads
drop policy if exists journal_read on public.journal_entries;
create policy journal_read on public.journal_entries for select to authenticated
  using (public.pet_role(pet_id) is not null);
drop policy if exists journal_insert on public.journal_entries;
create policy journal_insert on public.journal_entries for insert to authenticated
  with check (public.pet_role(pet_id) in ('owner', 'carer'));
drop policy if exists journal_update on public.journal_entries;
create policy journal_update on public.journal_entries for update to authenticated
  using (public.pet_role(pet_id) in ('owner', 'carer'));
drop policy if exists journal_delete on public.journal_entries;
create policy journal_delete on public.journal_entries for delete to authenticated
  using (public.pet_role(pet_id) in ('owner', 'carer'));

-- health: owner writes, members read
drop policy if exists health_read on public.health_entries;
create policy health_read on public.health_entries for select to authenticated
  using (public.pet_role(pet_id) is not null);
drop policy if exists health_write on public.health_entries;
create policy health_write on public.health_entries for all to authenticated
  using (public.pet_role(pet_id) = 'owner')
  with check (public.pet_role(pet_id) = 'owner');

-- care actions: owner + carer log, members read
drop policy if exists actions_read on public.care_actions;
create policy actions_read on public.care_actions for select to authenticated
  using (public.pet_role(pet_id) is not null);
drop policy if exists actions_insert on public.care_actions;
create policy actions_insert on public.care_actions for insert to authenticated
  with check (public.pet_role(pet_id) in ('owner', 'carer'));

-- care cards: owner manages, members can read metadata
drop policy if exists cards_owner on public.care_cards;
create policy cards_owner on public.care_cards for all to authenticated
  using (public.pet_role(pet_id) = 'owner')
  with check (public.pet_role(pet_id) = 'owner');
drop policy if exists cards_read on public.care_cards;
create policy cards_read on public.care_cards for select to authenticated
  using (public.pet_role(pet_id) is not null);

-- members + invitations: owner manages, members read
drop policy if exists members_read on public.pet_members;
create policy members_read on public.pet_members for select to authenticated
  using (public.pet_role(pet_id) is not null);
drop policy if exists members_owner on public.pet_members;
create policy members_owner on public.pet_members for all to authenticated
  using (public.pet_role(pet_id) = 'owner')
  with check (public.pet_role(pet_id) = 'owner');

drop policy if exists invites_read on public.invitations;
create policy invites_read on public.invitations for select to authenticated
  using (public.pet_role(pet_id) is not null);
drop policy if exists invites_owner on public.invitations;
create policy invites_owner on public.invitations for all to authenticated
  using (public.pet_role(pet_id) = 'owner')
  with check (public.pet_role(pet_id) = 'owner');

-- ---------- storage ----------
-- Create in Dashboard or via API; policies below assume these buckets exist:
--   pet-images (private) — pet + journal photos
--   documents  (private) — emergency bills / docs

insert into storage.buckets (id, name, public)
  values ('pet-images', 'pet-images', false), ('documents', 'documents', false)
  on conflict (id) do update set public = excluded.public;

drop policy if exists img_read on storage.objects;
create policy img_read on storage.objects for select to authenticated
  using (
    bucket_id = 'pet-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.pets p
        where p.photo_url = 'sb://pet-images/' || name
          and public.pet_role(p.id) is not null
      )
      or exists (
        select 1 from public.journal_entries j
        where j.photo_url = 'sb://pet-images/' || name
          and public.pet_role(j.pet_id) is not null
      )
    )
  );

drop policy if exists img_write on storage.objects;
create policy img_write on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists img_update on storage.objects;
create policy img_update on storage.objects for update to authenticated
  using (bucket_id = 'pet-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pet-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists img_delete on storage.objects;
create policy img_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pet-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists docs_read on storage.objects;
create policy docs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.health_entries h
        where h.photo_url = 'sb://documents/' || name
          and public.pet_role(h.pet_id) is not null
      )
    )
  );

drop policy if exists docs_owner on storage.objects;
create policy docs_owner on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
