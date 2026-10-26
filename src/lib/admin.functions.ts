import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { safeEqualSecret, signAdminToken, verifyAdminToken } from "./quiz.server";

/**
 * Admin server functions. The admin PIN never leaves the server; a signed,
 * expiring capability token is issued at login and verified on every call.
 */

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ pin: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!safeEqualSecret(data.pin, process.env["ADMIN_PIN"])) {
      return { ok: false as const, error: "Incorrect admin PIN." };
    }
    return { ok: true as const, token: signAdminToken(process.env["ADMIN_PIN"]) };
  });

function checkToken(token: string): { ok: false; error: string } | null {
  if (!verifyAdminToken(token, process.env["ADMIN_PIN"])) {
    return { ok: false, error: "Admin session expired. Please sign in again." };
  }
  return null;
}

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

export type AdminProfileRow = {
  id: string;
  name: string;
  roll_no: string;
  branch: string;
};

export const adminDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(10).max(512) }).parse(input),
  )
  .handler(async ({ data }) => {
    const denied = checkToken(data.token);
    if (denied) return { ok: false as const, error: denied.error };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [quizRes, pinRes, attemptRes, profileRes, questionRes] = await Promise.all([
      supabaseAdmin
        .from("quizzes")
        .select(
          "id, title, target_branch, duration_minutes, starts_at, ends_at, is_published, created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("quiz_pins").select("pin, quiz_id"),
      supabaseAdmin
        .from("attempts")
        .select(
          "id, quiz_id, student_id, status, score, started_at, submitted_at, auto_submitted, enrolled_manually, answers, profile:profiles(name, roll_no, branch)",
        )
        .order("submitted_at", { ascending: false, nullsFirst: false }),
      supabaseAdmin
        .from("profiles")
        .select("id, name, roll_no, branch")
        .order("roll_no", { ascending: true }),
      supabaseAdmin.from("questions").select("id, quiz_id, position, correct_index"),
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
      const quizQuestions = questions
        .filter((x) => x.quiz_id === quizId)
        .sort((a, b) => a.position - b.position);
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

    return { ok: true as const, quizzes: rows, profiles };
  });

const createQuizSchema = z.object({
  token: z.string().min(10).max(512),
  title: z.string().trim().min(3).max(120),
  targetBranch: z.string().min(1).max(20),
  durationMinutes: z.number().int().min(1).max(180),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  pin: z.string().trim().min(3).max(24),
  questions: z
    .array(
      z.object({
        prompt: z.string().trim().min(3).max(500),
        options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
        correctIndex: z.number().int().min(0).max(5),
      }),
    )
    .min(1)
    .max(50),
});

export const adminCreateQuiz = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createQuizSchema.parse(input))
  .handler(async ({ data }) => {
    const denied = checkToken(data.token);
    if (denied) return { ok: false as const, error: denied.error };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pinClash } = await supabaseAdmin
      .from("quiz_pins")
      .select("quiz_id")
      .eq("pin", data.pin)
      .maybeSingle();
    if (pinClash) {
      return { ok: false as const, error: "This quiz PIN is already in use. Choose another." };
    }

    const { data: quiz, error: quizErr } = await supabaseAdmin
      .from("quizzes")
      .insert({
        title: data.title,
        target_branch: data.targetBranch,
        duration_minutes: data.durationMinutes,
        starts_at: new Date(data.startsAt).toISOString(),
        ends_at: new Date(data.endsAt).toISOString(),
        is_published: true,
      })
      .select("id")
      .single();
    if (quizErr || !quiz) {
      return { ok: false as const, error: "Could not create the quiz. Check the dates and try again." };
    }

    const { error: qErr } = await supabaseAdmin.from("questions").insert(
      data.questions.map((q, i) => ({
        quiz_id: quiz.id,
        position: i + 1,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correctIndex,
      })),
    );
    if (qErr) {
      return { ok: false as const, error: "Quiz created but questions failed to save." };
    }

    const { error: pinErr } = await supabaseAdmin
      .from("quiz_pins")
      .insert({ pin: data.pin, quiz_id: quiz.id });
    if (pinErr) {
      return { ok: false as const, error: "Quiz created but its PIN failed to save." };
    }

    return { ok: true as const, quizId: quiz.id };
  });

const enrollSchema = z.object({
  token: z.string().min(10).max(512),
  quizId: z.string().uuid(),
  profileIds: z.array(z.string().uuid()).min(1).max(200),
});

export const adminEnroll = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => enrollSchema.parse(input))
  .handler(async ({ data }) => {
    const denied = checkToken(data.token);
    if (denied) return { ok: false as const, error: denied.error };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("attempts")
      .select("student_id")
      .eq("quiz_id", data.quizId)
      .in("student_id", data.profileIds);
    const already = new Set((existing ?? []).map((r) => r.student_id));
    const toAdd = data.profileIds.filter((id) => !already.has(id));
    if (toAdd.length === 0) {
      return { ok: true as const, added: 0 };
    }

    const { error } = await supabaseAdmin.from("attempts").insert(
      toAdd.map((studentId) => ({
        quiz_id: data.quizId,
        student_id: studentId,
        status: "in_progress",
        enrolled_manually: true,
      })),
    );
    if (error) return { ok: false as const, error: "Could not enroll the selected students." };
    return { ok: true as const, added: toAdd.length };
  });
