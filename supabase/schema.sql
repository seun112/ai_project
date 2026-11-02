-- 생활비 관리 시스템 테이블과 접근 규칙
-- Supabase의 SQL Editor에 전체를 붙여 넣고 한 번만 실행한다.
-- 계정과 비밀번호 해시는 Supabase Auth(auth.users)가 관리하므로 users 테이블은 만들지 않는다.

-- ---- 테이블 ----

create table public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 10),
  hidden boolean not null default false,
  primary key (user_id, id)
);

-- total은 건너뛴 달에 비어 있다. base_amount는 설정에서 총 금액을 줄이면 음수가 될 수 있다.
create table public.months (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  base_amount bigint not null default 0,
  carry_in bigint not null default 0 check (carry_in >= 0),
  deduction bigint not null default 0 check (deduction >= 0),
  total bigint,
  allocations jsonb not null default '{}'::jsonb,
  settled boolean not null default false,
  skipped boolean not null default false,
  primary key (user_id, month)
);

create table public.expenses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  date date not null,
  category_id text not null,
  amount bigint not null check (amount >= 1),
  memo text not null default '' check (char_length(memo) <= 30),
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
);

create index expenses_user_date on public.expenses (user_id, date);

create table public.piggy (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0)
);

create table public.piggy_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  date date not null,
  type text not null check (type in ('save', 'deficit')),
  amount bigint not null check (amount >= 1),
  memo text not null default '',
  primary key (user_id, id)
);

create table public.unsettled (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount bigint not null check (amount >= 1),
  primary key (user_id, month)
);

-- ---- Row Level Security: 로그인한 사용자는 자기 행만 읽고 쓴다 ----

alter table public.categories enable row level security;
alter table public.months enable row level security;
alter table public.expenses enable row level security;
alter table public.piggy enable row level security;
alter table public.piggy_history enable row level security;
alter table public.unsettled enable row level security;

create policy "own rows" on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.months for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.expenses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.piggy for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.piggy_history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.unsettled for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.categories, public.months, public.expenses, public.piggy, public.piggy_history, public.unsettled from anon;
grant select, insert, update, delete on public.categories, public.months, public.expenses, public.piggy, public.piggy_history, public.unsettled to authenticated;

-- ---- 저장: 바뀐 행을 한 트랜잭션으로 반영한다 ----
-- 정산은 저금통, 내역, 월 기록을 함께 바꾸므로 일부만 저장되면 금액이 어긋난다.
-- security invoker라서 위의 Row Level Security가 그대로 적용된다.

create function public.save_changes(changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  insert into public.categories (user_id, id, name, hidden)
  select me, r.id, r.name, r.hidden
  from jsonb_to_recordset(coalesce(changes -> 'categories', '[]'::jsonb)) as r (id text, name text, hidden boolean)
  on conflict (user_id, id) do update set name = excluded.name, hidden = excluded.hidden;

  insert into public.months (user_id, month, base_amount, carry_in, deduction, total, allocations, settled, skipped)
  select me, r.month, r.base_amount, r.carry_in, r.deduction, r.total, r.allocations, r.settled, r.skipped
  from jsonb_to_recordset(coalesce(changes -> 'months', '[]'::jsonb))
    as r (month text, base_amount bigint, carry_in bigint, deduction bigint, total bigint, allocations jsonb, settled boolean, skipped boolean)
  on conflict (user_id, month) do update set
    base_amount = excluded.base_amount,
    carry_in = excluded.carry_in,
    deduction = excluded.deduction,
    total = excluded.total,
    allocations = excluded.allocations,
    settled = excluded.settled,
    skipped = excluded.skipped;

  insert into public.expenses (user_id, id, date, category_id, amount, memo)
  select me, r.id, r.date, r.category_id, r.amount, r.memo
  from jsonb_to_recordset(coalesce(changes -> 'expenses', '[]'::jsonb))
    as r (id text, date date, category_id text, amount bigint, memo text)
  on conflict (user_id, id) do update set
    date = excluded.date,
    category_id = excluded.category_id,
    amount = excluded.amount,
    memo = excluded.memo;

  delete from public.expenses
  where user_id = me
    and id in (select jsonb_array_elements_text(coalesce(changes -> 'deleted_expenses', '[]'::jsonb)));

  delete from public.categories
  where user_id = me
    and id in (select jsonb_array_elements_text(coalesce(changes -> 'deleted_categories', '[]'::jsonb)));

  if changes ? 'piggy_balance' then
    insert into public.piggy (user_id, balance)
    values (me, (changes ->> 'piggy_balance')::bigint)
    on conflict (user_id) do update set balance = excluded.balance;
  end if;

  insert into public.piggy_history (user_id, id, date, type, amount, memo)
  select me, r.id, r.date, r.type, r.amount, r.memo
  from jsonb_to_recordset(coalesce(changes -> 'piggy_history', '[]'::jsonb))
    as r (id text, date date, type text, amount bigint, memo text)
  on conflict (user_id, id) do nothing;

  insert into public.unsettled (user_id, month, amount)
  select me, r.month, r.amount
  from jsonb_to_recordset(coalesce(changes -> 'unsettled', '[]'::jsonb)) as r (month text, amount bigint)
  on conflict (user_id, month) do update set amount = excluded.amount;
end;
$$;

revoke all on function public.save_changes(jsonb) from public, anon;
grant execute on function public.save_changes(jsonb) to authenticated;
