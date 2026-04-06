create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  source text not null default 'ravionite-website',
  actor_hash text not null default 'legacy',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.contact_messages
  add column if not exists source text not null default 'ravionite-website';

alter table public.contact_messages
  add column if not exists actor_hash text not null default 'legacy';

alter table public.contact_messages
  alter column actor_hash set default 'legacy';

alter table public.contact_messages
  drop column if exists word_count;

alter table public.contact_messages
  add column word_count integer generated always as (
    coalesce(array_length(regexp_split_to_array(trim(regexp_replace(message, E'\s+', ' ', 'g')), ' '), 1), 0)
  ) stored;

alter table public.contact_messages
  drop constraint if exists contact_messages_name_check;
alter table public.contact_messages
  add constraint contact_messages_name_check
  check (char_length(trim(name)) between 2 and 120);

alter table public.contact_messages
  drop constraint if exists contact_messages_email_check;
alter table public.contact_messages
  add constraint contact_messages_email_check
  check (lower(trim(email)) ~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$');

alter table public.contact_messages
  drop constraint if exists contact_messages_message_check;
alter table public.contact_messages
  add constraint contact_messages_message_check
  check (char_length(trim(message)) between 1 and 2400);

alter table public.contact_messages
  drop constraint if exists contact_messages_word_count_check;
alter table public.contact_messages
  add constraint contact_messages_word_count_check
  check (word_count between 1 and 200);

alter table public.contact_messages enable row level security;

drop policy if exists "Public can submit contact messages" on public.contact_messages;

create table if not exists public.public_submission_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('contact', 'admin_request', 'sample_chapter')),
  actor_hash text not null,
  email_hash text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.public_submission_events enable row level security;

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

create index if not exists public_submission_events_scope_actor_created_idx
  on public.public_submission_events (scope, actor_hash, created_at desc);

create index if not exists public_submission_events_scope_email_created_idx
  on public.public_submission_events (scope, email_hash, created_at desc);
