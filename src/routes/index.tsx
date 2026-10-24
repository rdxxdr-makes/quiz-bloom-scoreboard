import { createFileRoute, Link } from "@tanstack/react-router";
import { RdxFooter } from "@/components/rdx-footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Harsh Quiz Portal — RDX Quiz Series" },
      {
        name: "description",
        content: "Branch-wise timed quizzes for students, managed by admins. Sign in to begin.",
      },
      { property: "og:title", content: "Harsh Quiz Portal — RDX Quiz Series" },
      {
        property: "og:description",
        content: "Branch-wise timed quizzes for students, managed by admins. Sign in to begin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-14 text-center">
        <span className="rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          RDX Quiz Series
        </span>
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-6xl">
          Harsh Quiz Portal
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Branch-wise timed multiple-choice quizzes. Students sign in with their Roll No,
          enter the quiz PIN shared in class, and race the clock.
        </p>
        <div className="grid w-full max-w-lg gap-4 sm:grid-cols-2">
          <Link
            to="/student"
            className="group flex flex-col gap-1 rounded-xl border border-primary/30 bg-primary/10 px-6 py-5 text-left transition-colors hover:bg-primary/20"
          >
            <span className="text-lg font-bold text-primary">Student Login</span>
            <span className="text-xs text-muted-foreground">
              New here or returning — enter with your Roll No and PIN
            </span>
          </Link>
          <Link
            to="/admin"
            className="group flex flex-col gap-1 rounded-xl border border-border bg-card px-6 py-5 text-left transition-colors hover:bg-accent"
          >
            <span className="text-lg font-bold text-foreground">Admin Login</span>
            <span className="text-xs text-muted-foreground">
              Create quizzes, share PINs, enroll students and view results
            </span>
          </Link>
        </div>
      </section>
      <RdxFooter />
    </main>
  );
}
