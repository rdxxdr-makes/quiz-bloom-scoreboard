import { supabase } from "@/integrations/supabase/client";
import { gradeAnswers, type GradeQuestion } from "./grading";

/**
 * Fully client-side data layer. PIN checks happen in the UI components;
 * everything here reads and writes through the browser Supabase client.
 */

export type StoredProfile = { id: string; name: string; roll_no: string; branch: string };

export function normalizeRollNo(raw: string): string {
  return raw.trim().toUpperCase();
}

export function getStoredProfile(): StoredProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("rdx_student_profile");
    return raw ? (JSON.parse(raw) as StoredProfile) : null;
  } catch {
    return null;
  }
}

export function setStoredProfile(profile: StoredProfile): void {
  localStorage.setItem("rdx_student_profile", JSON.stringify(profile));
}

export function clearStoredProfile(): void {
  localStorage.removeItem("rdx_student_profile");
}

type Fail = { ok: false; error: string };

/** First-time student: PIN is already validated in the component. */
export async function onboardStudent(input: {
  name: string;
  rollNo: string;
  branch: string;
}): Promise<{ ok: true; profile: StoredProfile } | Fail> {
  const rollNo = normalizeRollNo(input.rollNo);
  const name = input.name.trim();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("roll_no", rollNo)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "This Roll No is already registered. Use Returning Student login." };
  }

  const profile: StoredProfile = { id: crypto.randomUUID(), name, roll_no: rollNo, branch: input.branch };
  const { error } = await supabase.from("profiles").insert({
    id: profile.id,
    name: profile.name,
    roll_no: profile.roll_no,
    branch: profile.branch,
    photo_path: null,
  });
  if (error) return { ok: false, error: "Could not save your profile. Please try again." };
  return { ok: true, profile };
}

/** Returning student: PIN is already validated in the component. */
export async function loginStudent(rollNoRaw: string): Promise<
  { ok: true; profile: StoredProfile } | Fail
> {
  const rollNo = normalizeRollNo(rollNoRaw);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, roll_no, branch")
    .ilike("roll_no", rollNo)
    .maybeSingle();
  if (!profile) {
    return { ok: false, error: "No profile found for this Roll No. Create your profile first." };
  }
  return {
    ok: true,
    profile: {
      id: profile.id,
      name: profile.name,
      roll_no: profile.roll_no,
      branch: profile.branch,
    },
  };
}

export type MyAttempt = {
  id: string;
  quiz_id: string;
  status: string;
  score: number | null;
  expires_at: string | null;
  started_at: string | null;
  enrolled_manually: boolean;
  auto_submitted: boolean;
  quiz: { title: string } | null;
};

/** Dashboard list: this student's attempts with quiz titles. */
export async function getMyAttempts(
  studentId: string,
): Promise<{ ok: true; attempts: MyAttempt[] } | Fail> {
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, quiz_id, status, score, expires_at, started_at, enrolled_manually, auto_submitted, quiz:quizzes(title)",
    )
    .eq("student_id", studentId)
    .order("started_at", { ascending: false, nullsFirst: false });
  if (error) return { ok: false, error: "Could not load your attempts." };
  return { ok: true, attempts: (data ?? []) as unknown as MyAttempt[] };
}

/** Start (or resume) an attempt by entering the admin-created quiz PIN. */
export async function startAttempt(
  studentId: string,
  quizPin: string,
): Promise<
  | {
      ok: true;
      attemptId: string;
      quizTitle: string;
      expiresAt: string | null;
      resumed: boolean;
    }
  | Fail
> {
  const nowIso = new Date().toISOString();
  const { data: pinRows } = await supabase
    .from("quiz_pins")
    .select("quiz_id")
    .eq("pin", quizPin.trim());
  const quizIds = (pinRows ?? []).map((r) => r.quiz_id);
  if (quizIds.length === 0) return { ok: false, error: "Invalid quiz PIN." };

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, target_branch, duration_minutes")
    .in("id", quizIds)
    .eq("is_published", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso);
  const { data: profile } = await supabase
    .from("profiles")
    .select("branch")
    .eq("id", studentId)
    .maybeSingle();
  const branch = profile?.branch ?? "";
  const quiz = (quizzes ?? []).find(
    (q) => q.target_branch === "ALL" || q.target_branch === branch,
  );
  if (!quiz) {
    return { ok: false, error: "Invalid quiz PIN, or the quiz is not open for you right now." };
  }

  const { data: existing } = await supabase
    .from("attempts")
    .select("id, status, expires_at")
    .eq("quiz_id", quiz.id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) {
    if (existing.status === "submitted") {
      return { ok: false, error: "You have already attempted this quiz." };
    }
    return {
      ok: true,
      attemptId: existing.id,
      quizTitle: quiz.title,
      expiresAt: existing.expires_at,
      resumed: true,
    };
  }

  const expiresAt = new Date(Date.now() + quiz.duration_minutes * 60_000).toISOString();
  const { data: attempt, error } = await supabase
    .from("attempts")
    .insert({
      quiz_id: quiz.id,
      student_id: studentId,
      started_at: nowIso,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !attempt) {
    return { ok: false, error: "Could not start the quiz. Please try again." };
  }
  return { ok: true, attemptId: attempt.id, quizTitle: quiz.title, expiresAt, resumed: false };
}

/** Admin manually enrolled the student; the timer starts when the student begins. */
export async function beginEnrolledAttempt(
  attemptId: string,
  studentId: string,
): Promise<{ ok: true; startedAt: string } | Fail> {
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, quiz_id, started_at, status")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!attempt || attempt.status !== "in_progress") {
    return { ok: false, error: "Attempt not available." };
  }
  if (attempt.started_at) return { ok: true, startedAt: attempt.started_at };

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("duration_minutes")
    .eq("id", attempt.quiz_id)
    .maybeSingle();
  const minutes = quiz?.duration_minutes ?? 10;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const { error } = await supabase
    .from("attempts")
    .update({ started_at: nowIso, expires_at: expiresAt })
    .eq("id", attemptId);
  if (error) return { ok: false, error: "Could not start the quiz. Please try again." };
  return { ok: true, startedAt: nowIso };
}

export type RunnerQuestion = { id: string; position: number; prompt: string; options: string[] };

export type RunnerPayload =
  | { ok: true; status: "submitted"; quizTitle: string; score: number | null; total: number; autoSubmitted: boolean }
  | { ok: true; status: "pending_start"; quizTitle: string; total: number; questions: RunnerQuestion[] }
  | {
      ok: true;
      status: "in_progress";
      quizTitle: string;
      total: number;
      questions: RunnerQuestion[];
      expiresAt: string;
      answers: Record<string, number>;
    }
  | Fail;

/** Loads the runner payload; questions are graded in the browser on submit. */
export async function getAttemptRunner(attemptId: string): Promise<RunnerPayload> {
  const { data: attempt } = await supabase
    .from("attempts")
    .select(
      "id, quiz_id, status, answers, score, expires_at, started_at, enrolled_manually, auto_submitted",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return { ok: false, error: "Attempt not found." };

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("title")
    .eq("id", attempt.quiz_id)
    .maybeSingle();
  const quizTitle = quiz?.title ?? "Quiz";

  const { data: questions } = await supabase
    .from("questions")
    .select("id, position, prompt, options, correct_index")
    .eq("quiz_id", attempt.quiz_id)
    .order("position", { ascending: true });
  const list = ((questions ?? []) as Array<{ id: string; position: number; prompt: string; options: unknown; correct_index: number }>).map(
    (q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: (q.options as string[]) ?? [],
    }),
  );

  if (attempt.status === "submitted") {
    return {
      ok: true,
      status: "submitted",
      quizTitle,
      score: attempt.score,
      total: list.length,
      autoSubmitted: attempt.auto_submitted,
    };
  }

  if (attempt.enrolled_manually && !attempt.started_at) {
    return { ok: true, status: "pending_start", quizTitle, total: list.length, questions: list };
  }
  return {
    ok: true,
    status: "in_progress",
    quizTitle,
    total: list.length,
    questions: list,
    expiresAt: attempt.expires_at,
    answers: (attempt.answers ?? {}) as Record<string, number>,
  };
}

export async function saveAttemptAnswer(
  attemptId: string,
  questionId: string,
  optionIndex: number,
): Promise<{ ok: true } | Fail> {
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, status, answers")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.status !== "in_progress") return { ok: false, error: "Attempt closed." };
  const answers = { ...((attempt.answers ?? {}) as Record<string, number>) };
  answers[questionId] = optionIndex;
  const { error } = await supabase.from("attempts").update({ answers }).eq("id", attemptId);
  if (error) return { ok: false, error: "Could not save your answer." };
  return { ok: true };
}

/**
 * Grades in the browser and saves the result. Expiry forces auto-submit
 * with whatever was saved.
 */
export async function submitAttempt(
  attemptId: string,
  auto: boolean,
): Promise<{ ok: true; score: number; total: number; alreadySubmitted: boolean } | Fail> {
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, quiz_id, status, answers, score, expires_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return { ok: false, error: "Attempt not found." };
  if (attempt.status === "submitted") {
    return { ok: true, score: attempt.score ?? 0, total: 0, alreadySubmitted: true };
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, correct_index")
    .eq("quiz_id", attempt.quiz_id);
  const list = (questions ?? []) as GradeQuestion[];
  const score = gradeAnswers((attempt.answers ?? {}) as Record<string, number>, list);

  const expired = !attempt.expires_at || new Date(attempt.expires_at).getTime() <= Date.now();
  const { error } = await supabase
    .from("attempts")
    .update({
      status: "submitted",
      score,
      submitted_at: new Date().toISOString(),
      auto_submitted: Boolean(auto) || expired,
    })
    .eq("id", attemptId);
  if (error) return { ok: false, error: "Could not submit. Please try again." };
  return { ok: true, score, total: list.length, alreadySubmitted: false };
}

// ============ Admin (client-side) ============

export type AdminProfileRow = { id: string; name: string; roll_no: string; branch: string };

export type AdminAttemptRow = {
  id: string;
  student_id: string;
  name: string;
  roll_no: string;
  branch: string;
  status: string;
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
  auto_submitted: boolean;
  enrolled_manually: boolean;
};

export type AdminQuizRow = {
  id: string;
  title: string;
  target_branch: string;
  duration_minutes: number;
  starts_at: string;
  ends_at: string;
  is_published: boolean;
  pin: string;
  questionCount: number;
  questionStats: Array<{ position: number; accuracy: number; answered: number }>;
  attempts: AdminAttemptRow[];
};

export async function adminDashboard(): Promise<
  { ok: true; quizzes: AdminQuizRow[]; profiles: AdminProfileRow[] } | Fail
> {
  const [quizRes, pinRes, attemptRes, profileRes, questionRes] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, target_branch, duration_minutes, starts_at, ends_at, is_published, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("quiz_pins").select("pin, quiz_id"),
    supabase
      .from("attempts")
      .select(
        "id, quiz_id, student_id, status, score, started_at, submitted_at, auto_submitted, enrolled_manually, answers, profile:profiles(name, roll_no, branch)",
      )
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    supabase.from("profiles").select("id, name, roll_no, branch").order("roll_no", { ascending: true }),
    supabase.from("questions").select("id, quiz_id, position, correct_index"),
  ]);

  const quizzes = (quizRes.data ?? []) as Array<{
    id: string;
    title: string;
    target_branch: string;
    duration_minutes: number;
    starts_at: string;
    ends_at: string;
    is_published: boolean;
  }>;
  const pins = (pinRes.data ?? []) as Array<{ pin: string; quiz_id: string }>;
  const profiles = (profileRes.data ?? []) as AdminProfileRow[];
  const attempts = (attemptRes.data ?? []) as Array<{
    id: string;
    quiz_id: string;
    student_id: string;
    status: string;
    score: number | null;
    started_at: string | null;
    submitted_at: string | null;
    auto_submitted: boolean;
    enrolled_manually: boolean;
    answers: Record<string, number> | null;
    profile: { name: string; roll_no: string; branch: string } | null;
  }>;
  const questions = (questionRes.data ?? []) as Array<{
    id: string;
    quiz_id: string;
    position: number;
    correct_index: number;
  }>;

  const rows: AdminQuizRow[] = quizzes.map((q) => {
    const quizId = q.id;
    const quizAttempts = attempts
      .filter((a) => a.quiz_id === quizId)
      .map((a) => ({
        id: a.id,
        student_id: a.student_id,
        name: a.profile?.name ?? "Unknown",
        roll_no: a.profile?.roll_no ?? "-",
        branch: a.profile?.branch ?? "-",
        status: a.status,
        score: a.score,
        started_at: a.started_at,
        submitted_at: a.submitted_at,
        auto_submitted: a.auto_submitted,
        enrolled_manually: a.enrolled_manually,
      }));
    const quizQuestions = questions.filter((x) => x.quiz_id === quizId).sort((a, b) => a.position - b.position);
    const questionStats = quizQuestions.map((qq) => {
      const answered = attempts.filter(
        (a) => a.quiz_id === quizId && a.status === "submitted" && a.answers && qq.id in a.answers,
      ).length;
      const correct = attempts.filter(
        (a) =>
          a.quiz_id === quizId &&
          a.status === "submitted" &&
          a.answers &&
          a.answers[qq.id] === qq.correct_index,
      ).length;
      return {
        position: qq.position,
        answered,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      };
    });
    return {
      id: quizId,
      title: String(q.title),
      target_branch: String(q.target_branch),
      duration_minutes: Number(q.duration_minutes),
      starts_at: String(q.starts_at),
      ends_at: String(q.ends_at),
      is_published: Boolean(q.is_published),
      pin: pins.find((p) => p.quiz_id === quizId)?.pin ?? "-",
      questionCount: quizQuestions.length,
      questionStats,
      attempts: quizAttempts,
    };
  });

  return { ok: true, quizzes: rows, profiles };
}

export type CreateQuizInput = {
  title: string;
  targetBranch: string;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  pin: string;
  isPublished: boolean;
  questions: Array<{ prompt: string; options: string[]; correctIndex: number }>;
};

export async function adminCreateQuiz(
  input: CreateQuizInput,
): Promise<{ ok: true; quizId: string } | Fail> {
  const { data: pinClash } = await supabase
    .from("quiz_pins")
    .select("quiz_id")
    .eq("pin", input.pin)
    .maybeSingle();
  if (pinClash) {
    return { ok: false, error: "This quiz PIN is already in use. Choose another." };
  }

  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      title: input.title,
      target_branch: input.targetBranch,
      duration_minutes: input.durationMinutes,
      starts_at: new Date(input.startsAt).toISOString(),
      ends_at: new Date(input.endsAt).toISOString(),
      is_published: input.isPublished,
    })
    .select("id")
    .single();
  if (quizErr || !quiz) {
    return { ok: false, error: "Could not create the quiz. Check the dates and try again." };
  }

  const { error: qErr } = await supabase.from("questions").insert(
    input.questions.map((q, i) => ({
      quiz_id: quiz.id,
      position: i + 1,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correctIndex,
    })),
  );
  if (qErr) return { ok: false, error: "Quiz created but questions failed to save." };

  const { error: pinErr } = await supabase
    .from("quiz_pins")
    .insert({ pin: input.pin, quiz_id: quiz.id });
  if (pinErr) return { ok: false, error: "Quiz created but its PIN failed to save." };

  return { ok: true, quizId: quiz.id };
}

export async function adminEnroll(input: {
  quizId: string;
  profileIds: string[];
}): Promise<{ ok: true; added: number } | Fail> {
  const { data: existing } = await supabase
    .from("attempts")
    .select("student_id")
    .eq("quiz_id", input.quizId)
    .in("student_id", input.profileIds);
  const already = new Set((existing ?? []).map((r) => r.student_id));
  const toAdd = input.profileIds.filter((id) => !already.has(id));
  if (toAdd.length === 0) return { ok: true, added: 0 };

  const { error } = await supabase.from("attempts").insert(
    toAdd.map((studentId) => ({
      quiz_id: input.quizId,
      student_id: studentId,
      status: "in_progress",
      enrolled_manually: true,
    })),
  );
  if (error) return { ok: false, error: "Could not enroll the selected students." };
  return { ok: true, added: toAdd.length };
}
