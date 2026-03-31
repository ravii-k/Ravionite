create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  message text not null check (char_length(trim(message)) > 0),
  word_count integer not null check (word_count between 1 and 200),
  source text not null default 'ravionite-website',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.contact_messages enable row level security;

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages"
on public.contact_messages
for insert
to anon
with check (
  char_length(trim(name)) between 2 and 120
  and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  and char_length(trim(message)) > 0
  and word_count between 1 and 200
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);
