-- LASER ESCAPE v7 online (GDD-v7 §3.3).
-- Everything lives in the private schema `game`, which is NOT exposed through the Data API:
-- anon/authenticated have no usage on it, so the only way in is the Edge Functions, which
-- connect with SUPABASE_DB_URL. RLS is still enabled on every table (defense in depth) with
-- deny-all policies for the client roles.

create schema if not exists game;
revoke all on schema game from public, anon, authenticated;

create table game.players (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  nickname text null check (nickname is null or char_length(nickname) between 2 and 12),
  created_at timestamptz not null default now()
);
-- nicknames are unique case-insensitively
create unique index players_nickname_lower_key on game.players (lower(nickname)) where nickname is not null;

-- verified runs only (score is the server re-simulated score)
create table game.runs (
  id bigint generated always as identity primary key,
  player_id uuid not null references game.players (id) on delete cascade,
  board text not null,
  score integer not null check (score >= 0),
  client_score integer not null,
  sim text not null,
  inputs jsonb not null,
  end_time real not null,
  created_at timestamptz not null default now()
);
create index runs_player_created_idx on game.runs (player_id, created_at desc);

-- every submit attempt (accepted or not) — the per-player rate limit counts these, so
-- rejected records cannot be used to burn simulator CPU
create table game.submissions (
  id bigint generated always as identity primary key,
  player_id uuid not null references game.players (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index submissions_player_created_idx on game.submissions (player_id, created_at desc);

create table game.best_scores (
  player_id uuid not null references game.players (id) on delete cascade,
  board text not null,
  score integer not null check (score >= 0),
  run_id bigint not null references game.runs (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (player_id, board)
);
-- leaderboard: top-N per board, ties broken by who got there first
create index best_scores_board_rank_idx on game.best_scores (board, score desc, updated_at asc);
create index best_scores_run_idx on game.best_scores (run_id);

create table game.achievements (
  player_id uuid not null references game.players (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null,
  primary key (player_id, achievement_id)
);

alter table game.players enable row level security;
alter table game.runs enable row level security;
alter table game.submissions enable row level security;
alter table game.best_scores enable row level security;
alter table game.achievements enable row level security;

-- explicit deny-all for client roles (the functions connect as the table owner)
create policy players_no_client on game.players as restrictive for all to anon, authenticated using (false) with check (false);
create policy runs_no_client on game.runs as restrictive for all to anon, authenticated using (false) with check (false);
create policy submissions_no_client on game.submissions as restrictive for all to anon, authenticated using (false) with check (false);
create policy best_scores_no_client on game.best_scores as restrictive for all to anon, authenticated using (false) with check (false);
create policy achievements_no_client on game.achievements as restrictive for all to anon, authenticated using (false) with check (false);

revoke all on all tables in schema game from public, anon, authenticated;
revoke all on all sequences in schema game from public, anon, authenticated;

-- Public leaderboard read: explicit columns only (never secret_hash / inputs).
-- SECURITY INVOKER (default); called by the leaderboard Edge Function.
create function game.leaderboard(p_board text, p_limit integer default 50)
returns table (rank bigint, player_id uuid, nickname text, score integer)
language sql
stable
set search_path = ''
as $$
  select
    rank() over (order by b.score desc) as rank,
    b.player_id,
    coalesce(p.nickname, '요원-' || upper(left(replace(p.id::text, '-', ''), 4))) as nickname,
    b.score
  from game.best_scores b
  join game.players p on p.id = b.player_id
  where b.board = p_board
  order by b.score desc, b.updated_at asc
  limit least(greatest(p_limit, 1), 100);
$$;

-- one player's row on a board (rank = 1 + number of strictly higher scores)
create function game.leaderboard_row(p_board text, p_player uuid)
returns table (rank bigint, player_id uuid, nickname text, score integer)
language sql
stable
set search_path = ''
as $$
  select
    1 + (select count(*) from game.best_scores o where o.board = b.board and o.score > b.score) as rank,
    b.player_id,
    coalesce(p.nickname, '요원-' || upper(left(replace(p.id::text, '-', ''), 4))) as nickname,
    b.score
  from game.best_scores b
  join game.players p on p.id = b.player_id
  where b.board = p_board and b.player_id = p_player;
$$;

revoke all on function game.leaderboard(text, integer) from public, anon, authenticated;
revoke all on function game.leaderboard_row(text, uuid) from public, anon, authenticated;
