create table if not exists public.profiles (
  google_id text primary key,
  email text not null,
  name text not null,
  picture text,
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  google_id text not null references public.profiles(google_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists notes_google_id_created_at_idx
  on public.notes (google_id, created_at desc);

-- L’application utilise la clé service_role uniquement dans le serveur Express.
-- Ne jamais placer cette clé dans le JavaScript du navigateur.
