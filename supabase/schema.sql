-- KIN — Supabase schema
-- Run this in Supabase SQL Editor before using the web app.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null,
  color text not null default '#7F6FD4',
  avatar_initials text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date text not null,
  start_time text,
  end_time text,
  description text default '',
  linked_to text default null,
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.day_notes (
  id uuid primary key default gen_random_uuid(),
  date text not null unique,
  content text default '',
  todos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.verticals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text default 'pending review',
  phase text default 'planning',
  summary text default '',
  description text default '',
  partner text default '',
  owner_id uuid references public.profiles(id) on delete set null,
  health text default 'watch',
  proposed boolean not null default true,
  milestones jsonb not null default '[]'::jsonb,
  docs jsonb not null default '[]'::jsonb,
  notes_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.b2a (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  status text default 'lead',
  owner_id uuid references public.profiles(id) on delete set null,
  summary text default '',
  challenge text default '',
  fronts jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  contacts jsonb not null default '[]'::jsonb,
  docs jsonb not null default '[]'::jsonb,
  notes text default '',
  proposed boolean not null default true,
  notes_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  category text default 'explore',
  color text default '#F5F0E8',
  blocks jsonb not null default '[]'::jsonb,
  linked_to text default null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null,
  billing text default 'monthly',
  category text default 'tools',
  owner_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  focus text default '',
  color text default '#7F6FD4',
  type text default 'team',
  status text default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.talent (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text default '',
  status text default 'observing',
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.inbox (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  context text default null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists touch_events_updated_at on public.events;
create trigger touch_events_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

drop trigger if exists touch_day_notes_updated_at on public.day_notes;
create trigger touch_day_notes_updated_at
before update on public.day_notes
for each row execute function public.touch_updated_at();

drop trigger if exists touch_verticals_updated_at on public.verticals;
create trigger touch_verticals_updated_at
before update on public.verticals
for each row execute function public.touch_updated_at();

drop trigger if exists touch_b2a_updated_at on public.b2a;
create trigger touch_b2a_updated_at
before update on public.b2a
for each row execute function public.touch_updated_at();

drop trigger if exists touch_notes_updated_at on public.notes;
create trigger touch_notes_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

create index if not exists events_date_idx on public.events(date);
create index if not exists day_notes_date_idx on public.day_notes(date);
create index if not exists verticals_proposed_idx on public.verticals(proposed);
create index if not exists b2a_proposed_idx on public.b2a(proposed);
create index if not exists notes_category_idx on public.notes(category);
create index if not exists costs_active_idx on public.costs(active);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.day_notes enable row level security;
alter table public.verticals enable row level security;
alter table public.b2a enable row level security;
alter table public.notes enable row level security;
alter table public.costs enable row level security;
alter table public.team enable row level security;
alter table public.talent enable row level security;
alter table public.inbox enable row level security;

drop policy if exists "Authenticated users can do everything" on public.profiles;
create policy "Authenticated users can do everything"
on public.profiles
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.events;
create policy "Authenticated users can do everything"
on public.events
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.day_notes;
create policy "Authenticated users can do everything"
on public.day_notes
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.verticals;
create policy "Authenticated users can do everything"
on public.verticals
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.b2a;
create policy "Authenticated users can do everything"
on public.b2a
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.notes;
create policy "Authenticated users can do everything"
on public.notes
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.costs;
create policy "Authenticated users can do everything"
on public.costs
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.team;
create policy "Authenticated users can do everything"
on public.team
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.talent;
create policy "Authenticated users can do everything"
on public.talent
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can do everything" on public.inbox;
create policy "Authenticated users can do everything"
on public.inbox
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create or replace function public.is_allowed_email(email_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(email) = lower(email_input)
  );
$$;

revoke all on function public.is_allowed_email(text) from public;
grant execute on function public.is_allowed_email(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('kin-attachments', 'kin-attachments', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "Authenticated users can upload attachments" on storage.objects;
create policy "Authenticated users can upload attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kin-attachments'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated users can update attachments" on storage.objects;
create policy "Authenticated users can update attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'kin-attachments'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'kin-attachments'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated users can delete attachments" on storage.objects;
create policy "Authenticated users can delete attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'kin-attachments'
  and auth.role() = 'authenticated'
);

drop policy if exists "Anyone can view public attachments" on storage.objects;
create policy "Anyone can view public attachments"
on storage.objects
for select
using (bucket_id = 'kin-attachments');
