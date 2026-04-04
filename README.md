# KIN

KIN is the internal executive operating system of Kind Tech, rebuilt here as a
web app with Next.js 14, Supabase and Vercel.

## Stack

- Next.js 14 App Router
- Tailwind CSS + CSS custom properties
- Supabase Auth, Postgres, Realtime and Storage
- Vercel deployment target

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. In Supabase SQL editor run:

- `supabase/schema.sql`
- `supabase/seed.sql`

4. Before running `seed.sql`, create the board users in Supabase Auth and
update the placeholder emails in the seed file so the `profiles` rows can link
to the correct auth users.

5. Start the app:

```bash
npm run dev
```

6. Production build check:

```bash
npm run build
```

## What is included

- Email + password login with whitelist check via `profiles.email`
- Protected app shell with sidebar, header, theme toggle and global capture
- Overview, Calendar, Verticals, B2A, Notes, Team and Costs pages
- Supabase-backed autosave and realtime refresh
- Storage uploads for vertical docs, B2A docs, event attachments and note media

## Important note about profiles and auth

The app checks whitelist access before login using `profiles.email`. Because of
that, the intended flow is:

1. create the allowed board users in Supabase Auth
2. define a password for each of those users in Supabase Auth
3. run the seed SQL so `profiles` rows are created with the matching user ids

## Deployment

Deploy to Vercel and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Also set Supabase Auth `Site URL` to your Vercel URL and make sure Realtime is
enabled for the relevant tables.
