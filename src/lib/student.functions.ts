import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gradeAnswers } from "./grading";
import { BRANCHES } from "./constants";
import { normalizeRollNo, safeEqualSecret, syntheticEmail } from "./quiz.server";

const studentOnboardSchema = z.object({
  pin: z.string().min(1).max(32),
  name: z.string().trim().min(2, "Name is too short").max(80),
  rollNo: z.string().trim().min(1, "Roll No is required").max(32),
  branch: z.enum(BRANCHES),
});

/** First-time student: verify the student PIN server-side, then create auth user + profile. */
export const onboardStudent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => studentOnboardSchema.parse(input))
  .handler(async ({ data }) => {
    if (!safeEqualSecret(data.pin, process.env.STUDENT_PIN)) {
      return { ok: false as const, error: "Incorrect student PIN." };
    }
    const rollNo = normalizeRollNo(data.rollNo);
    const email = syntheticEmail(rollNo);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("roll_no", rollNo)
      .maybeSingle();
    if (existing) {
      return { ok: false as const, error: "This Roll No is already registered. Use Returning Student login." };
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.pin,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return { ok: false as const, error: "Could not create your account. Please try again." };
    }

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      name: data.name,
      roll_no: rollNo,
      branch: data.branch,
      photo_path: null,
    });
    if (profErr) {
      return { ok: false as const, error: "Could not save your profile. Please try again." };
    }

    // The client completes sign-in with signInWithPassword(email, pin).
    return { ok: true as const, email };
  });

const studentLoginSchema = z.object({
  pin: z.string().min(1).max(32),
  rollNo: z.string().trim().min(1, "Roll No is required").max(32),
});

/** Returning student: PIN is checked against the server secret, never stored client-side. */
export const loginStudent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => studentLoginSchema.parse(input))
  .handler(async ({ data }) => {
    if (!safeEqualSecret(data.pin, process.env.STUDENT_PIN)) {
      return { ok: false as const, error: "Incorrect student PIN." };
    }
    const rollNo = normalizeRollNo(data.rollNo);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, roll_no, branch")
      .ilike("roll_no", rollNo)
      .maybeSingle();
    if (!profile) {
      return { ok: false as const, error: "No profile found for this Roll No. Create your profile first." };
    }
    return { ok: true as const, email: syntheticEmail(rollNo), profile };
  });

const startAttemptSchema = z.object({ quizPin: z.string().trim().min(3).max(24) });

/** Start (or resume) an attempt by entering the admin-created quiz PIN. */
export const startAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startAttemptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, branch")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return { ok: false as const, error: "Profile not found. Please log in again." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data: pinRows } = await supabaseAdmin
      .from("quiz_pins")
      .select("quiz_id")
      .eq("pin", data.quizPin);
    const quizIds = (pinRows ?? []).map((r) => r.quiz_id);
    if (quizIds.length === 0) return { ok: false as const, error: "Invalid quiz PIN." };

    const { data: quizzes } = await supabaseAdmin
      .from("quizzes")
      .select("id, title, target_branch, duration_minutes")
      .in("id", quizIds)
      .eq("is_published", true)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso);
    const quiz = (quizzes ?? []).find(
      (q) => q.target_branch === "ALL" || q.target_branch === profile.branch,
    );
    if (!quiz) {
      return { ok: false as const, error: "Invalid quiz PIN, or the quiz is not open for you right now." };
    }

    const { data: existing } = await supabase
      .from("attempts")
      .select("id, status, expires_at")
      .eq("quiz_id", quiz.id)
      .eq("student_id", userId)
      .maybeSingle();
    if (existing) {
      if (existing.status === "submitted") {
        return { ok: false as const, error: "You have already attempted this quiz." };
      }
      return {
        ok: true as const,
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
        student_id: userId,
        started_at: nowIso,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error || !attempt) {
      return { ok: false as const, error: "Could not start the quiz. Please try again." };
    }
    return { ok: true as const, attemptId: attempt.id, quizTitle: quiz.title, expiresAt, resumed: false };
  });

const attemptSchema = z.object({ attemptId: z.string().uuid() });

/** Admin manually enrolled the student; the timer starts when the student begins. */
export const beginEnrolledAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => attemptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase
      .from("attempts")
      .select("id, quiz_id, started_at, status")
      .eq("id", data.attemptId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!attempt || attempt.status !== "in_progress") {
      return { ok: false as const, error: "Attempt not available." };
    }
    if (attempt.started_at) {
      return { ok: true as const, startedAt: attempt.started_at };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quiz } = await supabaseAdmin
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
      .eq("id", data.attemptId);
    if (error) return { ok: false as const, error: "Could not start the quiz. Please try again." };
    return { ok: true as const, startedAt: nowIso };
  });

export type RunnerQuestion = { id: string; position: number; prompt: string; options: string[] };

/** Loads the runner payload. Correct answers are stripped — students never see them. */
export const getAttemptRunner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => attemptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase
      .from("attempts")
      .select(
        "id, quiz_id, status, answers, score, expires_at, started_at, enrolled_manually, auto_submitted",
      )
      .eq("id", data.attemptId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!attempt) return { ok: false as const, error: "Attempt not found." };

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("title")
      .eq("id", attempt.quiz_id)
      .maybeSingle();
    const quizTitle = quiz?.title ?? "Quiz";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, position, prompt, options")
      .eq("quiz_id", attempt.quiz_id)
      .order("position", { ascending: true });
    const list = ((questions ?? []) as RunnerQuestion[]).map((q) => ({
      ...q,
      options: (q.options as unknown as string[]) ?? [],
    }));

    if (attempt.status === "submitted") {
      return {
        ok: true as const,
        status: "submitted" as const,
        quizTitle,
        score: attempt.score,
        total: list.length,
        autoSubmitted: attempt.auto_submitted,
      };
    }

    const base = { ok: true as const, quizTitle, total: list.length, questions: list };
    if (attempt.enrolled_manually && !attempt.started_at) {
      return { ...base, status: "pending_start" as const };
    }
    return {
      ...base,
      status: "in_progress" as const,
      expiresAt: attempt.expires_at,
      answers: (attempt.answers ?? {}) as Record<string, number>,
    };
  });

const saveAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().min(1).max(64),
  optionIndex: z.number().int().min(0).max(3),
});

export const saveAttemptAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveAnswerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase
      .from("attempts")
      .select("id, status, answers")
      .eq("id", data.attemptId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!attempt || attempt.status !== "in_progress") return { ok: false as const };
    const answers = { ...((attempt.answers ?? {}) as Record<string, number>) };
    answers[data.questionId] = data.optionIndex;
    const { error } = await supabase.from("attempts").update({ answers }).eq("id", data.attemptId);
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

const submitSchema = z.object({
  attemptId: z.string().uuid(),
  auto: z.boolean().optional(),
});

/** Grades server-side; expiry forces auto-submit with whatever was saved. */
export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase
      .from("attempts")
      .select("id, quiz_id, status, answers, score, expires_at")
      .eq("id", data.attemptId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!attempt) return { ok: false as const, error: "Attempt not found." };
    if (attempt.status === "submitted") {
      return { ok: true as const, score: attempt.score, alreadySubmitted: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, correct_index")
      .eq("quiz_id", attempt.quiz_id);
    const list = (questions ?? []) as Array<{ id: string; correct_index: number }>;
    const score = gradeAnswers((attempt.answers ?? {}) as Record<string, number>, list);

    const expired =
      !attempt.expires_at || new Date(attempt.expires_at).getTime() <= Date.now();
    const { error } = await supabase
      .from("attempts")
      .update({
        status: "submitted",
        score,
        submitted_at: new Date().toISOString(),
        auto_submitted: Boolean(data.auto) || expired,
      })
      .eq("id", data.attemptId);
    if (error) return { ok: false as const, error: "Could not submit. Please try again." };
    return { ok: true as const, score, total: list.length, alreadySubmitted: false };
  });

/** Dashboard list: this student's attempts with quiz titles. */
export const getMyAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("attempts")
      .select(
        "id, quiz_id, status, score, expires_at, started_at, enrolled_manually, auto_submitted, quiz:quizzes(title)",
      )
      .order("started_at", { ascending: false, nullsFirst: false });
    if (error) return { ok: false as const, error: "Could not load your attempts." };
    return { ok: true as const, attempts: data ?? [] };
  });
