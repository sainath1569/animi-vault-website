-- Lets the app server apply ADMIN_EMAIL at startup through the service role.
-- Stores the email for the signup trigger and promotes the account if it exists.

create or replace function public.sync_admin_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  promoted int;
begin
  if p_email is null or btrim(p_email) = '' then
    return false;
  end if;
  insert into private.config (key, value) values ('admin_email', btrim(p_email))
  on conflict (key) do update set value = excluded.value;

  update public.profiles p set role = 'admin'
  from auth.users u
  where u.id = p.id and lower(u.email) = lower(btrim(p_email)) and p.role <> 'admin';
  get diagnostics promoted = row_count;
  return promoted > 0;
end;
$$;

revoke all on function public.sync_admin_email(text) from public, anon, authenticated;
grant execute on function public.sync_admin_email(text) to service_role;
