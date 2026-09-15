-- Reprezentatywny schemat spójny z zapytaniami w kodzie (Supabase / PostgreSQL).
-- Uwaga: to szkielet pokazujący relacje i kolumny, nie pełna migracja produkcyjna.

-- Użytkownicy aplikacji (rola + relacja menedżer→doradca dla nadzoru zespołowego).
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'Doradca'
              check (role in ('Doradca', 'Menedżer', 'Administrator')),
  manager_id  uuid references public.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_users_manager on public.users(manager_id);

-- Klienci — przypisani do doradcy prowadzącego (portfel doradcy).
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  email          text,
  phone          text,
  owner_id       uuid references public.users(id),
  profile_color  text check (profile_color in ('Czerwony','Żółty','Zielony','Niebieski')),
  ai_hint        text,
  favorite       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_clients_owner on public.clients(owner_id);

-- Rekordy (np. sprawa / zgłoszenie) powiązane z klientem.
create table if not exists public.records (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  title       text,
  status      text not null default 'Nowa'
              check (status in ('Nowa','Potencjalna','Wygrana','Odrzucona')),
  due_date    date,
  value       numeric(12,2),
  created_at  timestamptz not null default now()
);
create index if not exists idx_records_client on public.records(client_id);
create index if not exists idx_records_due on public.records(due_date);

-- Zaplanowane akcje (follow-upy) powiązane z rekordem.
create table if not exists public.planned_actions (
  id                 uuid primary key default gen_random_uuid(),
  record_id          uuid not null references public.records(id) on delete cascade,
  action_type        text not null,
  scheduled_at       timestamptz not null,
  suggested_content  text,
  is_completed       boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_actions_record on public.planned_actions(record_id);
create index if not exists idx_actions_open on public.planned_actions(is_completed, scheduled_at);
