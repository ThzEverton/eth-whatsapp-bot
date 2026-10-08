-- ETH / WhatsApp: capacity-controlled demonstration.
-- Execute in a dedicated Postgres/Supabase project before enabling signups.
create table if not exists public.demo_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot smallint not null unique check(slot between 1 and 5),
  created_at timestamptz not null default now()
);
alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;
grant select on public.demo_accounts to authenticated;
create policy "read own slot" on public.demo_accounts
  for select to authenticated using (user_id=auth.uid());
-- Signup reservation must run using a privileged server-side transaction only,
-- never from the browser / anon role. Advisory transaction lock serializes signups.
create or replace function public.reserve_demo_slot(p_user_id uuid)
returns smallint language plpgsql security definer set search_path = public
as $$
declare v_slot smallint;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(70812105);
  select slot into v_slot from public.demo_accounts where user_id=p_user_id;
  if v_slot is not null then return v_slot; end if;
  select n into v_slot from generate_series(1,5) n
    where not exists(select 1 from public.demo_accounts where slot=n) limit 1;
  if v_slot is null then raise exception 'demo capacity reached' using errcode='P0001'; end if;
  insert into public.demo_accounts(user_id,slot) values(p_user_id,v_slot);
  return v_slot;
end;
$$;
revoke all on function public.reserve_demo_slot(uuid) from public, anon, authenticated;
grant execute on function public.reserve_demo_slot(uuid) to service_role;
