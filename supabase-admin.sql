create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_users
  add column if not exists display_name text;

alter table public.admin_users
  add column if not exists phone text;

alter table public.admin_users enable row level security;

drop policy if exists "Admins can view their own row" on public.admin_users;
create policy "Admins can view their own row"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can update their own row" on public.admin_users;
create policy "Admins can update their own row"
on public.admin_users
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  requested_name text not null check (char_length(trim(requested_name)) between 2 and 120),
  requested_email text not null check (requested_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  requested_phone text not null check (char_length(regexp_replace(requested_phone, '\D', '', 'g')) between 7 and 15),
  status text not null default 'pending' check (status in ('pending', 'approved', 'deleted')),
  requested_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  approved_user_id uuid references auth.users (id) on delete set null,
  resolution_note text
);

alter table public.admin_requests enable row level security;

create unique index if not exists admin_requests_pending_email_idx
  on public.admin_requests (lower(requested_email))
  where status = 'pending';

drop policy if exists "Anyone can submit admin requests" on public.admin_requests;
create policy "Anyone can submit admin requests"
on public.admin_requests
for insert
to anon, authenticated
with check (
  status = 'pending'
  and char_length(trim(requested_name)) between 2 and 120
  and requested_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  and char_length(regexp_replace(requested_phone, '\D', '', 'g')) between 7 and 15
);

drop policy if exists "Approved admins can view admin requests" on public.admin_requests;
create policy "Approved admins can view admin requests"
on public.admin_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins can view contact messages" on public.contact_messages;
create policy "Admins can view contact messages"
on public.contact_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);
