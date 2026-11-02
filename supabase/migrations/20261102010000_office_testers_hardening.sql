-- Hardening for office tester flag (security review 2026-11-02):
-- 1) RLS on the allow-list as defence in depth (grants are already revoked).
-- 2) Never grant the flag while an email change is pending (autoconfirm / email-change edge cases).
alter table game.office_testers enable row level security;

create or replace function game.apply_office_tester()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_tester boolean;
begin
  is_tester := new.email is not null
    and new.email_confirmed_at is not null
    and coalesce(new.email_change, '') = ''
    and exists (select 1 from game.office_testers t where t.email = lower(new.email));
  if is_tester then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('office_tester', true);
  else
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) - 'office_tester';
  end if;
  return new;
end;
$$;
revoke all on function game.apply_office_tester() from public, anon, authenticated;

drop trigger if exists office_tester_flag on auth.users;
create trigger office_tester_flag
  before insert or update of email, email_confirmed_at, email_change on auth.users
  for each row execute function game.apply_office_tester();
