-- Office (칼퇴근 대작전) tester accounts: an allow-list kept server-side. A user whose VERIFIED email is listed
-- gets raw_app_meta_data.office_tester = true (signed into the JWT, not user-editable); everyone else gets it removed.
-- The client turns on tester mode (무적 + 전 단계 개방) only from session.user.app_metadata.office_tester.
create table if not exists game.office_testers (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);
revoke all on game.office_testers from public, anon, authenticated;

insert into game.office_testers (email, note) values ('breton5797@gmail.com', 'owner test account (무적 + 전 단계 개방)')
on conflict (email) do nothing;

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
  before insert or update of email, email_confirmed_at on auth.users
  for each row execute function game.apply_office_tester();

-- backfill any existing account
update auth.users set email = email where email is not null;
