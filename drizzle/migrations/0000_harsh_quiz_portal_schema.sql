create type public.branch_type as enum ('CSE-A', 'CSE-B', 'AI-DS', 'CSE(AI)', 'ECE');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  roll_no text not null,
  branch public.branch_type not null,
  photo_path text,
  created_at timestamptz not null default now()
);
create unique index profiles_roll_no_lower_idx on public.profiles (lower(roll_no));

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  target_branch text not null default 'ALL' check (target_branch in ('ALL','CSE-A','CSE-B','AI-DS','CSE(AI)','ECE')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes int not null check (duration_minutes between 1 and 300),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.quiz_pins (
  quiz_id uuid primary key references public.quizzes(id) on delete cascade,
  pin text not null
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null check (position between 1 and 200),
  prompt text not null,
  options jsonb not null,
  correct_index int not null check (correct_index between 0 and 3),
  unique (quiz_id, position)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_manually boolean not null default false,
  started_at timestamptz,
  expires_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  answers jsonb not null default '{}'::jsonb,
  score int,
  submitted_at timestamptz,
  auto_submitted boolean not null default false,
  unique (quiz_id, student_id)
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
GRANT ALL ON public.quiz_pins TO service_role;
GRANT ALL ON public.questions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

create policy "Students read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Students insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Students update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Students read published quizzes or ones they attempted" on public.quizzes for select to authenticated
using (is_published or exists (select 1 from public.attempts a where a.quiz_id = id and a.student_id = auth.uid()));

create policy "Students read own attempts" on public.attempts for select to authenticated using (student_id = auth.uid());
create policy "Students insert own attempts" on public.attempts for insert to authenticated with check (student_id = auth.uid());
create policy "Students update own attempts" on public.attempts for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy "Students manage own photos" on storage.objects for all to authenticated
using (bucket_id = 'student-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'student-photos' and (storage.foldername(name))[1] = auth.uid()::text);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-000000000001', 'authenticated', 'authenticated', 'cse-a-001@students.rdxquiz.app', crypt('333444', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
 ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-000000000002', 'authenticated', 'authenticated', 'cse-b-014@students.rdxquiz.app', crypt('333444', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
 ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-000000000003', 'authenticated', 'authenticated', 'aid-007@students.rdxquiz.app', crypt('333444', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
 ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-000000000004', 'authenticated', 'authenticated', 'cai-021@students.rdxquiz.app', crypt('333444', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
 ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-8111-000000000005', 'authenticated', 'authenticated', 'ece-009@students.rdxquiz.app', crypt('333444', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values
 ('a1111111-1111-4111-8111-000000000001', 'a1111111-1111-4111-8111-000000000001', 'email', jsonb_build_object('sub','a1111111-1111-4111-8111-000000000001','email','cse-a-001@students.rdxquiz.app','email_verified',true), now(), now(), now()),
 ('a1111111-1111-4111-8111-000000000002', 'a1111111-1111-4111-8111-000000000002', 'email', jsonb_build_object('sub','a1111111-1111-4111-8111-000000000002','email','cse-b-014@students.rdxquiz.app','email_verified',true), now(), now(), now()),
 ('a1111111-1111-4111-8111-000000000003', 'a1111111-1111-4111-8111-000000000003', 'email', jsonb_build_object('sub','a1111111-1111-4111-8111-000000000003','email','aid-007@students.rdxquiz.app','email_verified',true), now(), now(), now()),
 ('a1111111-1111-4111-8111-000000000004', 'a1111111-1111-4111-8111-000000000004', 'email', jsonb_build_object('sub','a1111111-1111-4111-8111-000000000004','email','cai-021@students.rdxquiz.app','email_verified',true), now(), now(), now()),
 ('a1111111-1111-4111-8111-000000000005', 'a1111111-1111-4111-8111-000000000005', 'email', jsonb_build_object('sub','a1111111-1111-4111-8111-000000000005','email','ece-009@students.rdxquiz.app','email_verified',true), now(), now(), now());

insert into public.profiles (id, name, roll_no, branch) values
 ('a1111111-1111-4111-8111-000000000001', 'Aarav Sharma', 'CSE-A-001', 'CSE-A'),
 ('a1111111-1111-4111-8111-000000000002', 'Diya Patel', 'CSE-B-014', 'CSE-B'),
 ('a1111111-1111-4111-8111-000000000003', 'Rohan Verma', 'AID-007', 'AI-DS'),
 ('a1111111-1111-4111-8111-000000000004', 'Ishaan Gupta', 'CAI-021', 'CSE(AI)'),
 ('a1111111-1111-4111-8111-000000000005', 'Meera Iyer', 'ECE-009', 'ECE');

insert into public.quizzes (id, title, target_branch, starts_at, ends_at, duration_minutes, is_published)
values ('11111111-1111-4111-8111-000000000001', 'Demo Quiz: CS Fundamentals', 'ALL', now() - interval '1 day', now() + interval '7 days', 10, true);

insert into public.quiz_pins (quiz_id, pin) values ('11111111-1111-4111-8111-000000000001', '505050');

insert into public.questions (id, quiz_id, position, prompt, options, correct_index) values
 ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 1, 'Which data structure works in FIFO (First In, First Out) order?', '["Stack","Queue","Tree","Graph"]'::jsonb, 1),
 ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 2, 'What does HTTP stand for?', '["HyperText Transfer Protocol","High Transfer Text Protocol","HyperText Transit Process","Hyperlink Text Transfer Path"]'::jsonb, 0),
 ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000001', 3, 'What is 2 raised to the power of 10?', '["512","1000","1024","2048"]'::jsonb, 2),
 ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-000000000001', 4, 'Which of the following is an operating system?', '["Python","Linux","HTML","SQL"]'::jsonb, 1),
 ('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-000000000001', 5, 'What is the time complexity of binary search on a sorted array?', '["O(n)","O(n log n)","O(log n)","O(n squared)"]'::jsonb, 2);

insert into public.attempts (id, quiz_id, student_id, started_at, expires_at, status, answers, score, submitted_at)
values
 ('33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000001', 'a1111111-1111-4111-8111-000000000001', now() - interval '5 hours', now() - interval '5 hours' + interval '10 minutes', 'submitted', '{"22222222-2222-4222-8222-000000000001":1,"22222222-2222-4222-8222-000000000002":0,"22222222-2222-4222-8222-000000000003":2,"22222222-2222-4222-8222-000000000004":0,"22222222-2222-4222-8222-000000000005":2}', 4, now() - interval '5 hours'),
 ('33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-000000000001', 'a1111111-1111-4111-8111-000000000002', now() - interval '3 hours', now() - interval '3 hours' + interval '10 minutes', 'submitted', '{"22222222-2222-4222-8222-000000000001":1,"22222222-2222-4222-8222-000000000002":3,"22222222-2222-4222-8222-000000000003":2,"22222222-2222-4222-8222-000000000004":0,"22222222-2222-4222-8222-000000000005":1}', 2, now() - interval '3 hours');