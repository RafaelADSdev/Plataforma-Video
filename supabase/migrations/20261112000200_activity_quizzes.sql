-- Authoring data stays out of the Data API, even for a published quiz.
create table private.activity_quizzes (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  questions jsonb not null,
  revision uuid not null default gen_random_uuid(),
  allow_retries boolean not null default false,
  show_answers boolean not null default false
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  answers jsonb not null,
  correct_count integer not null,
  question_count integer not null check (question_count > 0 and correct_count between 0 and question_count),
  created_at timestamptz not null default now(),
  unique (activity_id, user_id, request_id),
  unique (activity_id, user_id, attempt_number)
);

alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from public, anon, authenticated, service_role;
grant select on public.quiz_attempts to authenticated, service_role;
create policy quiz_attempts_select_visible on public.quiz_attempts for select to authenticated
using (
  exists (select 1 from public.activities where id = activity_id)
  and (user_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') in ('professor', 'admin'))
);

create function private.validate_quiz_questions(questions jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  question jsonb;
  choice jsonb;
  seen_questions uuid[] := '{}';
  seen_choices uuid[];
  question_id uuid;
  choice_id uuid;
  correct_id uuid;
begin
  if jsonb_typeof(questions) is distinct from 'array' then
    raise exception 'Adicione pelo menos uma questão.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(questions) not between 1 and 50 then
    raise exception 'Use de 1 a 50 questões.' using errcode = 'P0001';
  end if;
  for question in select value from jsonb_array_elements(questions) loop
    question_id := (question ->> 'id')::uuid;
    correct_id := (question ->> 'correctOptionId')::uuid;
    if question_id is null or question_id = any(seen_questions)
      or coalesce(char_length(btrim(question ->> 'prompt')), 0) not between 1 and 2000
      or jsonb_typeof(question -> 'options') is distinct from 'array' then
      raise exception 'Preencha o enunciado de cada questão.' using errcode = 'P0001';
    end if;
    if jsonb_array_length(question -> 'options') not between 2 and 6 then
      raise exception 'Cada questão precisa de 2 a 6 alternativas.' using errcode = 'P0001';
    end if;
    seen_questions := array_append(seen_questions, question_id);
    seen_choices := '{}';
    for choice in select value from jsonb_array_elements(question -> 'options') loop
      choice_id := (choice ->> 'id')::uuid;
      if choice_id is null or choice_id = any(seen_choices)
        or coalesce(char_length(btrim(choice ->> 'text')), 0) not between 1 and 500 then
        raise exception 'Preencha todas as alternativas.' using errcode = 'P0001';
      end if;
      seen_choices := array_append(seen_choices, choice_id);
    end loop;
    if correct_id is null or not (correct_id = any(seen_choices)) then
      raise exception 'Marque uma alternativa correta em cada questão.' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

create function public.save_course_activity(
  p_id uuid,
  p_module_id uuid,
  p_lesson_id uuid,
  p_kind text,
  p_title text,
  p_instructions text,
  p_published_at timestamptz,
  p_due_at timestamptz,
  p_support_path text,
  p_support_name text,
  p_questions jsonb,
  p_allow_retries boolean,
  p_show_answers boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.activities;
  quiz private.activity_quizzes;
  resolved_module uuid := p_module_id;
begin
  if not coalesce(auth.jwt() -> 'app_metadata' ->> 'role' in ('professor', 'admin'), false) then
    raise exception 'Apenas a equipe pode editar atividades.' using errcode = '42501';
  end if;
  if p_lesson_id is not null then
    select module_id into resolved_module from public.lessons where id = p_lesson_id;
  end if;
  if resolved_module is null or not exists (select 1 from public.modules where id = resolved_module) then
    raise exception 'Escolha um módulo ou uma aula válida.' using errcode = 'P0001';
  end if;

  select * into existing from public.activities where id = p_id for update;
  if found and existing.kind <> p_kind then
    raise exception 'O formato da atividade é definido na criação.' using errcode = 'P0001';
  end if;
  if p_support_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'activity-materials' and name = p_support_path
      and metadata ->> 'mimetype' = 'application/pdf'
  ) then
    raise exception 'O PDF de apoio não foi encontrado.' using errcode = 'P0001';
  end if;

  if p_kind = 'quiz' then
    select * into quiz from private.activity_quizzes where activity_id = p_id;
    if quiz.activity_id is null or not exists (select 1 from public.quiz_attempts where activity_id = p_id) then
      perform private.validate_quiz_questions(p_questions);
    elsif p_questions is not null and (
      quiz.questions is distinct from p_questions
      or quiz.allow_retries is distinct from p_allow_retries
      or quiz.show_answers is distinct from p_show_answers
    ) then
      raise exception 'O questionário já recebeu respostas. As questões e regras estão protegidas.' using errcode = 'P0001';
    end if;
  end if;

  if existing.id is null then
    insert into public.activities
      (id, module_id, lesson_id, kind, title, instructions, published_at, due_at, support_path, support_name)
    values (p_id, resolved_module, p_lesson_id, p_kind, btrim(p_title), btrim(p_instructions),
      p_published_at, p_due_at, p_support_path, p_support_name);
  else
    update public.activities
    set module_id = resolved_module, lesson_id = p_lesson_id, title = btrim(p_title),
      instructions = btrim(p_instructions), published_at = p_published_at, due_at = p_due_at,
      support_path = p_support_path, support_name = p_support_name
    where id = p_id;
  end if;

  if p_kind = 'quiz' and p_questions is not null then
    insert into private.activity_quizzes (activity_id, questions, allow_retries, show_answers)
    values (p_id, p_questions, p_allow_retries, p_show_answers)
    on conflict (activity_id) do update
    set questions = excluded.questions, allow_retries = excluded.allow_retries,
      show_answers = excluded.show_answers, revision = gen_random_uuid()
    where (activity_quizzes.questions, activity_quizzes.allow_retries, activity_quizzes.show_answers)
      is distinct from (excluded.questions, excluded.allow_retries, excluded.show_answers);
  end if;
  return p_id;
end;
$$;

create function public.read_activity_quiz(p_activity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  role text := auth.jwt() -> 'app_metadata' ->> 'role';
  staff boolean := coalesce(role in ('professor', 'admin'), false);
  quiz private.activity_quizzes;
  has_attempt boolean;
begin
  if actor is null or not (staff or coalesce(role = 'aluno', false))
    or not exists (
      select 1 from public.activities as activity where id = p_activity_id and kind = 'quiz'
        and (staff or private.activity_available(activity))
    ) then
    return null;
  end if;
  select * into quiz from private.activity_quizzes where activity_id = p_activity_id;
  if not found then return null; end if;
  select exists (
    select 1 from public.quiz_attempts where activity_id = p_activity_id and (staff or user_id = actor)
  ) into has_attempt;
  return jsonb_build_object(
    'revision', quiz.revision,
    'allowRetries', quiz.allow_retries,
    'showAnswers', quiz.show_answers,
    'hasAttempt', has_attempt,
    'questions', (
      select jsonb_agg(
        jsonb_build_object('id', question -> 'id', 'prompt', question -> 'prompt',
          'options', (select jsonb_agg(jsonb_build_object('id', option -> 'id', 'text', option -> 'text') order by n)
            from jsonb_array_elements(question -> 'options') with ordinality as choices(option, n)))
        || case when staff or (quiz.show_answers and has_attempt)
          then jsonb_build_object('correctOptionId', question -> 'correctOptionId') else '{}'::jsonb end
        order by i
      ) from jsonb_array_elements(quiz.questions) with ordinality as entries(question, i)
    )
  );
end;
$$;

create function public.submit_activity_quiz(
  p_activity_id uuid, p_revision uuid, p_request_id uuid, p_answers jsonb
)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  activity public.activities;
  quiz private.activity_quizzes;
  attempt public.quiz_attempts;
  previous_count integer;
  correct integer := 0;
  question jsonb;
  selected_option text;
begin
  if actor is null or not coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'aluno', false) then
    raise exception 'Somente alunos enviam respostas.' using errcode = '42501';
  end if;

  -- The same row lock serializes submissions and authoring, so an edit
  -- cannot change the key between grading and recording the first attempt.
  select * into activity from public.activities where id = p_activity_id and kind = 'quiz' for update;
  if not found or not private.activity_available(activity) then
    raise exception 'Questionário indisponível.' using errcode = '42501';
  end if;

  select * into attempt from public.quiz_attempts
    where activity_id = p_activity_id and user_id = actor and request_id = p_request_id;
  if found then return attempt; end if;

  select * into quiz from private.activity_quizzes where activity_id = p_activity_id;
  if not found or p_revision is distinct from quiz.revision then
    raise exception 'O questionário mudou. Recarregue a página e responda novamente.' using errcode = 'P0001';
  end if;
  select count(*) into previous_count from public.quiz_attempts where activity_id = p_activity_id and user_id = actor;
  if previous_count > 0 and not quiz.allow_retries then
    raise exception 'Você já usou a tentativa disponível.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Selecione uma alternativa para cada questão.' using errcode = 'P0001';
  end if;
  if (select count(*) from jsonb_object_keys(p_answers)) <> jsonb_array_length(quiz.questions) then
    raise exception 'Selecione uma alternativa para cada questão.' using errcode = 'P0001';
  end if;

  for question in select value from jsonb_array_elements(quiz.questions) loop
    selected_option := p_answers ->> (question ->> 'id');
    if not exists (select 1 from jsonb_array_elements(question -> 'options') where value ->> 'id' = selected_option) then
      raise exception 'Selecione uma alternativa válida em cada questão.' using errcode = 'P0001';
    end if;
    if selected_option = question ->> 'correctOptionId' then
      correct := correct + 1;
    end if;
  end loop;

  insert into public.quiz_attempts (activity_id, user_id, request_id, attempt_number, answers, correct_count, question_count)
  values (p_activity_id, actor, p_request_id, previous_count + 1, p_answers, correct, jsonb_array_length(quiz.questions))
  returning * into attempt;
  return attempt;
end;
$$;

revoke all on function private.validate_quiz_questions(jsonb) from public, anon, authenticated;
revoke all on function public.save_course_activity(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text, text, jsonb, boolean, boolean),
  public.read_activity_quiz(uuid), public.submit_activity_quiz(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_course_activity(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text, text, jsonb, boolean, boolean),
  public.read_activity_quiz(uuid), public.submit_activity_quiz(uuid, uuid, uuid, jsonb) to authenticated;
