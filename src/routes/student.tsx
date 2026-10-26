import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { BRANCHES } from "@/lib/constants";
import {
  onboardStudent,
  loginStudent,
  startAttempt,
  beginEnrolledAttempt,
  getAttemptRunner,
  saveAttemptAnswer,
  submitAttempt,
  getMyAttempts,
} from "@/lib/student.functions";
import { RdxFooter } from "@/components/rdx-footer";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "Student Login — Harsh Quiz Portal" },
      {
        name: "description",
        content: "Sign in with your Roll No and student PIN to take RDX quizzes.",
      },
      { property: "og:title", content: "Student Login — Harsh Quiz Portal" },
      {
        property: "og:description",
        content: "Sign in with your Roll No and student PIN to take RDX quizzes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentPage,
});

type MyAttempt = {
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

type RunnerPayload = {
  ok: true;
  status: "in_progress" | "pending_start" | "submitted";
  quizTitle: string;
  total: number;
  questions?: { id: string; position: number; prompt: string; options: string[] }[];
  expiresAt?: string | null;
  answers?: Record<string, number>;
  score?: number | null;
  autoSubmitted?: boolean;
};

function StudentPage() {
  const [state, setState] = useState<"loading" | "signedOut" | "signedIn">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? "signedIn" : "signedOut");
    });
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to portal
          </Link>
          {state === "loading" ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : state === "signedOut" ? (
            <AuthPanel onSignedIn={() => setState("signedIn")} />
          ) : (
            <StudentHome onSignedOut={() => setState("signedOut")} />
          )}
        </div>
      </div>
      <RdxFooter />
    </main>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const btnCls =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

function AuthPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"new" | "returning">("returning");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onboardFn = useServerFn(onboardStudent);
  const loginFn = useServerFn(loginStudent);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const pin = String(form.get("pin") ?? "");
      if (mode === "new") {
        const res = await onboardFn({
          data: {
            pin,
            name: String(form.get("name") ?? ""),
            rollNo: String(form.get("rollNo") ?? ""),
            branch: String(form.get("branch") ?? ""),
          },
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword({
          email: res.email,
          password: pin,
        });
        if (err) {
          setError("Account created but sign-in failed. Please try returning login.");
          return;
        }
        onSignedIn();
      } else {
        const res = await loginFn({ data: { pin, rollNo: String(form.get("rollNo") ?? "") } });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword({
          email: res.email,
          password: pin,
        });
        if (err) {
          setError(err.message);
          return;
        }
        onSignedIn();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8">
      <h1 className="text-2xl font-bold text-foreground">Student Login</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your student PIN is shared in class. It is checked on the server only.
      </p>
      <div className="mt-4 flex gap-2">
        {(["returning", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {m === "new" ? "First-time setup" : "Returning student"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5">
        {mode === "new" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Full name</span>
              <input name="name" required minLength={2} className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Branch</span>
              <select name="branch" required className={inputCls} defaultValue={BRANCHES[0]}>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Roll No</span>
          <input name="rollNo" required className={inputCls} placeholder="e.g. 21CSE045" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Student PIN</span>
          <input name="pin" type="password" required className={inputCls} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className={`${btnCls} w-full`}>
          {busy ? "Please wait…" : mode === "new" ? "Create profile & sign in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function StudentHome({ onSignedOut }: { onSignedOut: () => void }) {
  const [profile, setProfile] = useState<{ name: string; roll_no: string; branch: string } | null>(
    null,
  );
  const [attempts, setAttempts] = useState<MyAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runner, setRunner] = useState<{
    attemptId: string;
    quizTitle: string;
    expiresAt?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      onSignedOut();
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("name, roll_no, branch")
      .eq("id", userData.user.id)
      .maybeSingle();
    setProfile(prof ?? null);
    const res = await getMyAttempts();
    if (res.ok) setAttempts(res.attempts);
    else setError(res.error);
  }, [onSignedOut]);

  useEffect(() => {
    load();
  }, [load]);

  const startFn = useServerFn(startAttempt);
  const beginFn = useServerFn(beginEnrolledAttempt);

  const startByPin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const pin = String(new FormData(e.currentTarget).get("quizPin") ?? "").trim();
    const res = await startFn({ data: { quizPin: pin } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRunner({ attemptId: res.attemptId, quizTitle: res.quizTitle, expiresAt: res.expiresAt });
  };

  const resumeEnrolled = async (attempt: MyAttempt) => {
    setError(null);
    const res = await beginFn({ data: { attemptId: attempt.id } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRunner({ attemptId: attempt.id, quizTitle: attempt.quiz?.title ?? "Quiz" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    onSignedOut();
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hi {profile?.name ?? "student"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {profile ? `${profile.roll_no} · ${profile.branch}` : "Loading profile…"}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      <form
        onSubmit={startByPin}
        className="space-y-3 rounded-xl border border-primary/30 bg-card p-5"
      >
        <h2 className="font-semibold text-foreground">Enter a quiz PIN</h2>
        <p className="text-xs text-muted-foreground">
          Ask the admin for the PIN of the quiz running right now.
        </p>
        <div className="flex gap-2">
          <input name="quizPin" required className={inputCls} placeholder="Quiz PIN" />
          <button type="submit" className={btnCls}>
            Start
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section>
        <h2 className="mb-2 font-semibold text-foreground">My quizzes</h2>
        <div className="space-y-2">
          {attempts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No quizzes yet. Enter a quiz PIN above, or wait for the admin to enroll you.
            </p>
          )}
          {attempts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{a.quiz?.title ?? "Quiz"}</p>
                <p className="text-xs text-muted-foreground">
                  {a.status === "submitted"
                    ? `Scored ${a.score ?? 0}${a.auto_submitted ? " (auto-submitted)" : ""}`
                    : a.started_at
                      ? "In progress — resume before time runs out"
                      : "Enrolled by admin — not started yet"}
                </p>
              </div>
              {a.status !== "submitted" && (
                <button type="button" onClick={() => resumeEnrolled(a)} className={btnCls}>
                  {a.started_at ? "Resume" : "Start now"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {runner && (
        <Runner
          attemptId={runner.attemptId}
          quizTitle={runner.quizTitle}
          expiresAt={runner.expiresAt}
          onFinished={() => {
            setRunner(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Runner({
  attemptId,
  quizTitle,
  expiresAt,
  onFinished,
}: {
  attemptId: string;
  quizTitle: string;
  expiresAt?: string | null | undefined;
  onFinished: () => void;
}) {
  const loadFn = useServerFn(getAttemptRunner);
  const saveFn = useServerFn(saveAttemptAnswer);
  const submitFn = useServerFn(submitAttempt);
  const beginFn = useServerFn(beginEnrolledAttempt);

  const [payload, setPayload] = useState<RunnerPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const submittedRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await loadFn({ data: { attemptId } });
    if (res.ok) setPayload(res);
  }, [attemptId, loadFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (payload?.status === "in_progress") setAnswers(payload.answers ?? {});
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.status !== "in_progress") return;
    const end = new Date(payload.expiresAt ?? expiresAt ?? "").getTime();
    if (!end) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [payload, expiresAt]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      const res = await submitFn({ data: { attemptId, auto } });
      setSubmitting(false);
      if (res.ok) {
        const total = "total" in res ? res.total : (payload?.total ?? 0);
        setResult({ score: res.score, total });
        onFinished();
      } else {
        submittedRef.current = false;
      }
    },
    [attemptId, payload, submitFn, onFinished],
  );

  useEffect(() => {
    if (remaining === 0 && payload?.status === "in_progress") submit(true);
  }, [remaining, payload, submit]);

  if (!payload) {
    return <p className="text-sm text-muted-foreground">Loading quiz…</p>;
  }

  if (payload.status === "submitted" || result) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="text-xl font-bold text-foreground">{payload.quizTitle} — submitted</h2>
        <p className="mt-2 text-4xl font-black text-primary">
          {result ? result.score : (payload.score ?? 0)} / {result ? result.total : payload.total}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {payload.autoSubmitted || result === null ? "" : ""}
          1 point per correct answer
        </p>
        <button type="button" onClick={onFinished} className={`${btnCls} mt-4`}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (payload.status === "pending_start") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">{payload.quizTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You were enrolled by the admin. The timer starts when you begin.
        </p>
        <button
          type="button"
          className={`${btnCls} mt-4`}
          onClick={async () => {
            const res = await beginFn({ data: { attemptId } });
            if (res.ok) refresh();
          }}
        >
          Begin quiz
        </button>
      </div>
    );
  }

  const mins = remaining !== null ? Math.floor(remaining / 60) : null;
  const secs = remaining !== null ? remaining % 60 : null;

  return (
    <div className="mt-8 rounded-xl border border-primary/30 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-foreground">{quizTitle || payload.quizTitle}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            remaining !== null && remaining < 60
              ? "bg-destructive text-destructive-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {mins !== null ? `⏱ ${mins}:${String(secs).padStart(2, "0")}` : "…"}
        </span>
      </div>
      <ol className="space-y-5">
        {payload.questions?.map((q, i) => (
          <li key={q.id}>
            <p className="text-sm font-medium text-foreground">
              {i + 1}. {q.prompt}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [q.id]: idx }));
                    saveFn({ data: { attemptId, questionId: q.id, optionIndex: idx } });
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    answers[q.id] === idx
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}. {opt}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={submitting}
        onClick={() => submit(false)}
        className={`${btnCls} mt-6 w-full`}
      >
        {submitting ? "Submitting…" : "Submit quiz"}
      </button>
    </div>
  );
}
