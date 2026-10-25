import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  adminLogin,
  adminDashboard,
  adminCreateQuiz,
  adminEnroll,
  type AdminQuizRow,
  type AdminProfileRow,
} from "@/lib/admin.functions";
import { ADMIN_TOKEN_KEY, APP_NAME, BRANCHES } from "@/lib/constants";
import { RdxFooter } from "@/components/rdx-footer";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — Harsh Quiz Portal" },
      {
        name: "description",
        content: "Admin console: create quizzes, enroll students, track live results.",
      },
      { property: "og:title", content: "Admin Console — Harsh Quiz Portal" },
      {
        property: "og:description",
        content: "Admin console: create quizzes, enroll students, track live results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type AdminData = {
  quizzes: AdminQuizRow[];
  profiles: AdminProfileRow[];
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
const btnCls =
  "inline-flex items-center justify-center rounded-lg grad-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-bloom transition-opacity hover:opacity-90 disabled:opacity-50";

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
    <main className="page-bloom flex min-h-screen flex-col">
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
      <Link to="/" className="text-xs font-semibold text-primary hover:opacity-80">
        ← Back to portal
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-foreground">Admin Login</h1>
      <form
        className="mt-4 space-y-3 rounded-2xl border border-border card-bloom p-5 shadow-bloom"
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
          <span className="mb-1 block font-medium text-muted-foreground">Admin PIN</span>
          <input name="pin" type="password" required className={inputCls} />
        </label>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
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

  const stats = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const activeQuizzes = data.quizzes.filter(
      (q) =>
        q.is_published &&
        new Date(q.starts_at).getTime() <= now &&
        new Date(q.ends_at).getTime() >= now,
    ).length;
    let submissions = 0;
    let scoreSum = 0;
    for (const q of data.quizzes) {
      for (const a of q.attempts) {
        if (a.status === "submitted") {
          submissions += 1;
          scoreSum += a.score ?? 0;
        }
      }
    }
    return {
      students: data.profiles.length,
      activeQuizzes,
      submissions,
      avg: submissions ? (scoreSum / submissions).toFixed(1) : "—",
    };
  }, [data]);

  const statusByProfile = useMemo(() => {
    const map = new Map<string, { label: string; tone: string; detail: string }>();
    if (!data) return map;
    for (const quiz of data.quizzes) {
      for (const a of quiz.attempts) {
        const label =
          a.status === "submitted"
            ? a.auto_submitted
              ? "Auto-submitted"
              : "Submitted"
            : a.enrolled_manually && !a.started_at
              ? "Enrolled"
              : "In progress";
        const detail =
          a.status === "submitted" ? `${quiz.title} · score ${a.score ?? 0}` : quiz.title;
        const prev = map.get(a.student_id);
        if (!prev || (prev.label !== "Submitted" && prev.label !== "Auto-submitted")) {
          map.set(a.student_id, { label, tone: toneFor(label), detail });
        }
      }
    }
    return map;
  }, [data]);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="text-grad-brand">Admin Console</span>
          </h1>
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        </div>
        <button
          type="button"
          onClick={onSignedOut}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total students" value={String(stats.students)} tone="blue" />
            <StatCard label="Active quizzes" value={String(stats.activeQuizzes)} tone="purple" />
            <StatCard label="Submissions" value={String(stats.submissions)} tone="green" />
            <StatCard label="Average score" value={stats.avg} tone="amber" />
          </div>
          <StudentDirectory profiles={data.profiles} statusByProfile={statusByProfile} />
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

function toneFor(label: string): string {
  if (label === "Submitted") return "green";
  if (label === "Auto-submitted") return "amber";
  if (label === "In progress") return "blue";
  return "purple";
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "purple" | "green" | "amber";
}) {
  const tones = {
    blue: "bg-brand-blue/12 text-brand-blue",
    purple: "bg-brand-purple/12 text-brand-purple",
    green: "bg-brand-green/12 text-brand-green",
    amber: "bg-brand-yellow/35 text-brand-yellow-foreground",
  } as const;
  const bars = {
    blue: "grad-primary",
    purple: "bg-brand-purple",
    green: "grad-go",
    amber: "grad-sun",
  } as const;
  return (
    <div className="overflow-hidden rounded-2xl border border-border card-bloom shadow-bloom">
      <div className={`h-1.5 w-full ${bars[tone]}`} />
      <div className="p-4">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${tones[tone].split(" ")[0]}`} />
        <p className="mt-1.5 text-2xl font-black text-foreground">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function StudentDirectory({
  profiles,
  statusByProfile,
}: {
  profiles: AdminProfileRow[];
  statusByProfile: Map<string, { label: string; tone: string; detail: string }>;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = profiles.filter((p) =>
    `${p.name} ${p.roll_no} ${p.branch}`.toLowerCase().includes(needle),
  );
  return (
    <div className="rounded-2xl border border-border card-bloom p-5 shadow-bloom">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">Student directory</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, roll no or branch…"
          className={`${inputCls} sm:max-w-xs`}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No students match that search.</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {filtered.map((p) => {
            const st = statusByProfile.get(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {p.name}{" "}
                    <span className="font-normal text-muted-foreground">({p.roll_no})</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.branch}
                    {st ? ` · ${st.detail}` : ""}
                  </p>
                </div>
                <StatusChip label={st?.label ?? "No attempt"} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  const cls =
    label === "Submitted"
      ? "bg-brand-green/15 text-brand-green"
      : label === "Auto-submitted"
        ? "bg-brand-yellow/30 text-brand-yellow-foreground"
        : label === "In progress"
          ? "bg-brand-blue/12 text-brand-blue"
          : label === "Live"
            ? "bg-brand-green/15 text-brand-green"
            : label === "Upcoming"
              ? "bg-brand-yellow/30 text-brand-yellow-foreground"
              : label === "Ended"
                ? "bg-muted text-muted-foreground"
                : label === "Draft"
                  ? "bg-brand-purple/12 text-brand-purple"
                  : "bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {label}
    </span>
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
  const [publish, setPublish] = useState(true);
  const [startsAt, setStartsAt] = useState(() =>
    new Date(Date.now() - 60_000).toISOString().slice(0, 16),
  );
  const [endsAt, setEndsAt] = useState(() =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { prompt: "", options: ["", "", "", ""], correctIndex: 0 },
  ]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
      >
        + Create a new quiz
      </button>
    );
  }

  const submit = async () => {
    setLocalError(null);
    if (title.trim().length < 3) {
      setLocalError("Give the quiz a title (at least 3 characters).");
      return;
    }
    if (pin.trim().length < 3) {
      setLocalError("Choose a quiz PIN of at least 3 characters.");
      return;
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setLocalError("The availability end must be after the start.");
      return;
    }
    if (questions.some((q) => !q.prompt.trim() || q.options.some((o) => !o.trim()))) {
      setLocalError("Fill in every question and all four options.");
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          token,
          title,
          targetBranch: branch,
          durationMinutes: duration,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          pin,
          isPublished: publish,
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
      setPublish(true);
      setQuestions([{ prompt: "", options: ["", "", "", ""], correctIndex: 0 }]);
      setOpen(false);
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border card-bloom p-5 shadow-bloom">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">New quiz</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
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
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Available from
          </span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Available until
          </span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Quiz PIN (e.g. RDX777)"
          className={`${inputCls} sm:col-span-3`}
        />
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Publish now
        </label>
      </div>
      <div className="mt-4 space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Question {qi + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive"
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
                    className="h-4 w-4 shrink-0 accent-[var(--brand-green)]"
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
      <p className="mt-2 text-xs text-muted-foreground">
        Tick the radio next to the correct option. Uncheck “Publish now” to save it as a draft.
      </p>
      {localError && <p className="mt-2 text-sm font-medium text-destructive">{localError}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            setQuestions([...questions, { prompt: "", options: ["", "", "", ""], correctIndex: 0 }])
          }
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          + Add question
        </button>
        <button type="button" onClick={submit} disabled={busy} className={btnCls}>
          {busy ? "Creating…" : publish ? "Create & publish quiz" : "Save draft"}
        </button>
      </div>
    </div>
  );
}

function quizStatus(quiz: AdminQuizRow): string {
  if (!quiz.is_published) return "Draft";
  const now = Date.now();
  if (new Date(quiz.ends_at).getTime() < now) return "Ended";
  if (new Date(quiz.starts_at).getTime() > now) return "Upcoming";
  return "Live";
}

function QuizCard({
  quiz,
  profiles,
  token,
  onDone,
}: {
  quiz: AdminQuizRow;
  profiles: AdminProfileRow[];
  token: string;
  onDone: () => void;
}) {
  const enrollFn = useServerFn(adminEnroll);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);

  const enrolledIds = new Set(quiz.attempts.map((a) => a.student_id));
  const status = quizStatus(quiz);

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
    <div className="rounded-2xl border border-border card-bloom p-5 shadow-bloom">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-foreground">{quiz.title}</h2>
            <StatusChip label={status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {quiz.target_branch} · {quiz.duration_minutes} min · {quiz.questionCount} questions ·
            window {new Date(quiz.starts_at).toLocaleDateString()} –{" "}
            {new Date(quiz.ends_at).toLocaleDateString()}
          </p>
        </div>
        <span className="rounded-full grad-primary px-3 py-1 text-xs font-bold tracking-wider text-primary-foreground">
          PIN {quiz.pin}
        </span>
      </div>

      {quiz.questionStats.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-background/70 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Question-wise accuracy
          </p>
          <div className="mt-2 space-y-2">
            {quiz.questionStats.map((s) => (
              <div key={s.position} className="flex items-center gap-3">
                <span className="w-8 text-xs font-bold text-foreground">Q{s.position}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      s.accuracy >= 70
                        ? "bg-brand-green"
                        : s.accuracy >= 40
                          ? "bg-brand-yellow"
                          : "bg-brand-red"
                    }`}
                    style={{ width: `${s.answered ? s.accuracy : 0}%` }}
                  />
                </div>
                <span className="w-28 text-right text-xs text-muted-foreground">
                  {s.answered ? `${s.accuracy}% · ${s.answered} answered` : "no answers yet"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <td className="py-1.5 pr-4">
                  <StatusChip
                    label={
                      a.status === "submitted"
                        ? a.auto_submitted
                          ? "Auto-submitted"
                          : "Submitted"
                        : a.enrolled_manually && !a.started_at
                          ? "Enrolled"
                          : "In progress"
                    }
                  />
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
        className="mt-3 text-xs font-bold text-primary hover:opacity-80"
      >
        {showEnroll ? "Hide enroll panel" : "Enroll students →"}
      </button>

      {showEnroll && (
        <div className="mt-2 rounded-xl border border-border bg-background p-3">
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
                  className="h-4 w-4 accent-[var(--primary)]"
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
          {msg && <p className="mt-2 text-xs font-medium text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}
