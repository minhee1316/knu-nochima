-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- 학생이 올린 공지는 status='pending'(검토 전)으로 들어가고,
-- 운영자가 Table Editor에서 'approved'(승인) 또는 'rejected'(숨김)로 바꾼다.

create table if not exists public.notices (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  type        text not null check (type in ('장학금', '비교과', '공모전', '공지')),
  title       text not null,
  org         text not null default '',
  amount      integer not null default 0 check (amount >= 0),
  deadline    date,
  cond        jsonb not null default '{}'::jsonb,
  docs        jsonb not null default '[]'::jsonb,
  summary     text not null default '',
  url         text not null default ''
);

-- 브라우저에서 직접 접근 금지: 정책(policy)을 만들지 않으면 서버의 secret 키로만 읽고 쓸 수 있다.
alter table public.notices enable row level security;

create index if not exists notices_status_deadline on public.notices (status, deadline);

-- ===== 호출 횟수 제한 카운터 =====
-- key 예: 'ex-m:<IP해시>:<시간창 번호>'. IP 원문은 저장하지 않는다.
create table if not exists public.rate_limits (
  key        text primary key,
  count      integer not null default 0,
  expires_at timestamptz not null
);
alter table public.rate_limits enable row level security;

-- 원자적으로 +1 하고 현재 횟수를 돌려준다. 가끔(2%) 만료된 줄을 지운다.
create or replace function public.rate_hit(p_key text, p_ttl integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare c integer;
begin
  if random() < 0.02 then
    delete from public.rate_limits where expires_at < now();
  end if;
  insert into public.rate_limits as r (key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_ttl))
  on conflict (key) do update set count = r.count + 1
  returning r.count into c;
  return c;
end;
$$;

-- 브라우저용 키(anon)로는 호출 못 하게: 서버 secret 키만 사용
revoke execute on function public.rate_hit(text, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer) to service_role;

-- 이미 테이블을 만든 경우: 종류에 '공모전' 추가
alter table public.notices drop constraint if exists notices_type_check;
alter table public.notices add constraint notices_type_check check (type in ('장학금', '비교과', '공모전', '공지'));

-- 관심 분야 태그 (AI·SW, 창업 …)
alter table public.notices add column if not exists tags jsonb not null default '[]'::jsonb;

-- 프로젝트 생성 때 'Automatically expose new tables'를 끈 경우에도 서버(secret 키)가 쓸 수 있게 명시적으로 허용
-- (브라우저용 anon·authenticated 역할에는 주지 않는다)
grant usage on schema public to service_role;
grant select, insert, update, delete on public.notices to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;
revoke all on public.notices, public.rate_limits from anon, authenticated;

-- ===== 자격판정기 전용 회원의 '내 조건' (강원대 K-Cloud와 무관) =====
-- 평점·학자금 지원구간은 저장하지 않는다(브라우저에만). 학생·교직원 구분은 본인 선택이며 검증하지 않는다.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default '학생' check (role in ('학생', '교직원', '지역주민', '방문객')),
  campus      text check (campus in ('춘천', '삼척', '도계', '강릉', '원주')),
  grade       text check (grade in ('1', '2', '3', '4')),
  college     text,
  residence   text,
  status      text,
  interests   jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to service_role;
revoke all on public.profiles from anon, authenticated;
