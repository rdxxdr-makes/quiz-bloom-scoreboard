import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  adminLogin,
  adminDashboard,
  adminCreateQuiz,
  adminEnroll,
  type AdminData as AdminDataT,
} from "@/lib/admin.functions";
import { ADMIN_TOKEN_KEY, APP_NAME, BRANCHES } from "@/lib/constants";
import { RdxFooter } from "@/components/rdx-footer";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Login — Harsh Quiz Portal" },
      {
        name: "description",
        content: "Admin console: create quizzes, enroll students and view results.",
      },
      { property: "og:title", content: "Admin Login — Harsh Quiz Portal" },
      {
        property: "og:description",
        content: "Admin console: create quizzes, enroll students and view results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type AdminData = {
  quizzes: AdminDataT["quizzes"];
  profiles: AdminDataT["profiles"];
};

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const btnCls =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready">("loading");

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!stored) {
      setState("login");
      return;
    }
    setToken(stored);
    setState("ready");
  }, []);

  if (state === "loading") {
    return (
      <MainShell>
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      </MainShell>
    );
  }
  if (state === "login" || !token) {
    return (
      <MainShell>
        <AdminLogin onSignedIn={(t) => { setToken(t); setState("ready"); }} />
      </MainShell>
    );
  }
  return (
    <MainShell>
      <AdminHome
        token={token}
        onSignedOut={() => {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setToken(null);
          setState("login");
        }}
      />
    </MainShell>
  );
}

function MainShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </div>
      <RdxFooter />
    </main>
  );
}

function AdminLogin({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const loginFn = useServerFn(adminLogin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-8 mx-auto max-w-sm">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to portal
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-foreground">Admin Login</h1>
      <form
        className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            const pin = String(new FormData(e.currentTarget).get("pin") ?? "");
            const res = await loginFn({ data: { pin } });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
            onSignedIn(res.token);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Admin PIN</span>
          <input name="pin" type="password" required className={inputCls} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className={`${btnCls} w-full`}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function AdminHome({ token, onSignedOut }: { token: string; onSignedOut: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await adminDashboard({ data: { token } });
    if (!res.ok) {
      setError(res.error);
      if (res.error.includes("expired")) onSignedOut();
      return;
    }
    setData({ quizzes: res.quizzes, profiles: res.profiles });
  }, [token, onSignedOut]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Console</h1>
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        </div>
        <button
          type="button"
          onClick={onSignedOut}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <CreateQuiz
            token={token}
            onCreated={() => {
              setError(null);
              load();
            }}
            onError={setError}
          />
          {data.quizzes.map((q) => (
            <QuizCard key={q.id} quiz={q} profiles={data.profiles} token={token} onDone={load} />
          ))}
        </>
      )}
    </div>
  );
}

type QuestionDraft = { prompt: string; options: string[]; correctIndex: number };

function CreateQuiz({
  token,
  onCreated,
  onError,
}: {
  token: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const createFn = useServerFn(adminCreateQuiz);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("ALL");
  const [duration, setDuration] = useState(10);
  const [pin, setPin] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { prompt: "", options: ["", "", "", ""], correctIndex: 0 },
  ]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm font-semibold text-primary"
      >
        + Create a new quiz
      </button>
    );
  }

  const submit = async () => {
    setLocalError(null);
    if (questions.some((q) => !q.prompt.trim() || q.options.some((o) => !o.trim()))) {
      setLocalError("Fill in every question and all four options.");
      return;
    }
    setBusy(true);
    try {
      const now = new Date();
      const res = await createFn({
        data: {
          token,
          title,
          targetBranch: branch,
          durationMinutes: duration,
          startsAt: now.toISOString(),
          endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          pin,
          questions: questions.map((q) => ({
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.correctIndex,
          })),
        },
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      setTitle("");
      setPin("");
      setQuestions([{ prompt: "", options: ["", "", "", ""], correctIndex: 0 }]);
      setOpen(false);
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">New quiz</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz title"
          className={`${inputCls} sm:col-span-2`}
        />
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inputCls}>
          <option value="ALL">All branches</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={180}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          placeholder="Minutes"
          className={inputCls}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Quiz PIN (e.g. RDX777)"
          className={`${inputCls} sm:col-span-2`}
        />
      </div>
      <div className="mt-4 space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Question {qi + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-destructive"
                  onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={q.prompt}
              onChange={(e) =>
                setQuestions(
                  questions.map((x, i) => (i === qi ? { ...x, prompt: e.target.value } : x)),
                )
              }
              placeholder="Question text"
              className={`${inputCls} mt-2`}
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.correctIndex === oi}
                    onChange={() =>
                      setQuestions(
                        questions.map((x, i) => (i === qi ? { ...x, correctIndex: oi } : x)),
                      )
                    }
                    title="Mark as correct"
                  />
                  <input
                    value={opt}
                    onChange={(e) =>
                      setQuestions(
                        questions.map((x, i) =>
                          i === qi
                            ? { ...x, options: x.options.map((o, j) => (j === oi ? e.target.value : o)) }
                            : x,
                        ),
                      )
                    }
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Tick the radio next to the correct option.</p>
      {localError && <p className="mt-2 text-sm text-destructive">{localError}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            setQuestions([...questions, { prompt: "", options: ["", "", "", ""], correctIndex: 0 }])
          }
          className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          + Add question
        </button>
        <button type="button" onClick={submit} disabled={busy} className={btnCls}>
          {busy ? "Creating…" : "Create & publish quiz"}
        </button>
      </div>
    </div>
  );
}

function QuizCard({
  quiz,
  profiles,
  token,
  onDone,
}: {
  quiz: AdminData["quizzes"][number];
  profiles: AdminData["profiles"];
  token: string;
  onDone: () => void;
}) {
  const enrollFn = useServerFn(adminEnroll);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);

  const enrolledIds = new Set(quiz.attempts.map((a) => a.id));

  const enroll = async () => {
    setMsg(null);
    const res = await enrollFn({
      data: { token, quizId: quiz.id, profileIds: Array.from(selected) },
    });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setSelected(new Set());
    setMsg(`Enrolled ${res.added} student(s).`);
    onDone();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-foreground">{quiz.title}</h2>
          <p className="text-xs text-muted-foreground">
            {quiz.target_branch} · {quiz.duration_minutes} min · {quiz.questionCount} questions ·
            window {new Date(quiz.starts_at).toLocaleDateString()} –{" "}
            {new Date(quiz.ends_at).toLocaleDateString()}
          </p>
        </div>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold tracking-wider text-primary">
          PIN {quiz.pin}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-1 pr-4">Student</th>
              <th className="py-1 pr-4">Branch</th>
              <th className="py-1 pr-4">Status</th>
              <th className="py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {quiz.attempts.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-xs text-muted-foreground">
                  No attempts yet.
                </td>
              </tr>
            )}
            {quiz.attempts.map((a) => (
              <tr key={a.id} className="border-t border-border/60">
                <td className="py-1.5 pr-4 text-foreground">
                  {a.name} <span className="text-muted-foreground">({a.roll_no})</span>
                </td>
                <td className="py-1.5 pr-4 text-muted-foreground">{a.branch}</td>
                <td className="py-1.5 pr-4 text-muted-foreground">
                  {a.status === "submitted"
                    ? a.auto_submitted
                      ? "Auto-submitted"
                      : "Submitted"
                    : a.enrolled_manually && !a.started_at
                      ? "Enrolled"
                      : "In progress"}
                </td>
                <td className="py-1.5 font-semibold text-foreground">
                  {a.status === "submitted" ? a.score ?? 0 : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => setShowEnroll(!showEnroll)}
        className="mt-3 text-xs font-semibold text-primary"
      >
        {showEnroll ? "Hide enroll panel" : "Enroll students →"}
      </button>

      {showEnroll && (
        <div className="mt-2 rounded-lg border border-border bg-background p-3">
          <div className="grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  disabled={enrolledIds.has(p.id)}
                  checked={selected.has(p.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    setSelected(next);
                  }}
                />
                {p.name} ({p.roll_no}, {p.branch})
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={enroll}
            disabled={selected.size === 0}
            className={`${btnCls} mt-3`}
          >
            Enroll {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}
