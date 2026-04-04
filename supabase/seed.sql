-- KIN — seed data
-- Run this after:
-- 1. creating the auth users in Supabase Auth
-- 2. running supabase/schema.sql
--
-- Replace the email addresses below so they match the real board users you created.

insert into public.profiles (id, email, name, role, color, avatar_initials)
select
  id,
  email,
  'Humberto Bastos',
  'CEO',
  '#E25C6A',
  'HB'
from auth.users
where lower(email) = lower('humberto@kindtech.pt')
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  color = excluded.color,
  avatar_initials = excluded.avatar_initials;

insert into public.profiles (id, email, name, role, color, avatar_initials)
select
  id,
  email,
  'Miguel',
  'CSO',
  '#7F6FD4',
  'M'
from auth.users
where lower(email) = lower('miguel@kindtech.pt')
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  color = excluded.color,
  avatar_initials = excluded.avatar_initials;

insert into public.profiles (id, email, name, role, color, avatar_initials)
select
  id,
  email,
  'Afonso Roque',
  'COO',
  '#4A9B72',
  'AR'
from auth.users
where lower(email) = lower('roque@kindtech.pt')
on conflict (id) do update set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  color = excluded.color,
  avatar_initials = excluded.avatar_initials;

insert into public.team (name, role, focus, color, type, status)
select *
from (
  values
    ('Humberto Bastos', 'CEO', 'Execution, partnerships and company direction', '#E25C6A', 'board', 'active'),
    ('Miguel', 'CSO', 'Strategy, positioning and venture development', '#7F6FD4', 'board', 'active'),
    ('Afonso Roque', 'COO', 'Operations, finance and company cadence', '#4A9B72', 'board', 'active')
) as seed(name, role, focus, color, type, status)
where not exists (
  select 1 from public.team existing where existing.name = seed.name
);

insert into public.verticals (
  name,
  status,
  phase,
  summary,
  description,
  partner,
  health,
  proposed
)
select
  'Compy™',
  'active',
  'pilot',
  'AI conversational companion for senior care and AgeTech.',
  'AI conversational companion for senior care and AgeTech.',
  'HopeCare',
  'stable',
  false
where not exists (
  select 1 from public.verticals where name = 'Compy™'
);

insert into public.notes (
  title,
  description,
  category,
  color,
  blocks
)
select
  'AI-native product positioning',
  'How should we position Kind Tech products in a world where AI is table stakes?',
  'explore',
  '#EDE8FF',
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'text',
      'text', 'How should we position Kind Tech products in a world where AI is table stakes?'
    )
  )
where not exists (
  select 1 from public.notes where title = 'AI-native product positioning'
);
