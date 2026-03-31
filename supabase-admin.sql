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
