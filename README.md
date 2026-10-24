# Quiz Bloom Scoreboard

Build “Harsh Quiz Portal”, a responsive web app using Supabase.

Security: validate pins only through Supabase Edge Functions/server secrets—never expose, hardcode, store, or log them in React, browser storage, page source, or public tables. Secrets: ADMIN_PIN=Harsh@100031 and STUDENT_PIN=333444. Use RLS: students access only their own profile/attempts; admin manages all. No quiz links; everything stays in-app.

Landing: Student Login / Admin Login.

Student: enter student PIN; first time, create profile with Name, Roll No., Branch dropdown (CSE-A, CSE-B, AI-DS, CSE(AI), ECE), optional photo. Save and redirect to dashboard. Later login with Roll No. + student PIN. Dashboard shows active branch/all-student quizzes. To start, enter the admin-created quiz PIN. Take timed MCQ quiz (one question at a time, 4 options, Previous/Next, timer, auto-submit on expiry). After submit, show score/confirmation only.

Admin: log in using admin PIN. Dashboard shows total students, active quizzes, submissions, average score. Student directory must be searchable and show profile/photo/attempt status; admin can manually add a student to a quiz after its quiz PIN expires. Easy quiz creator: title, target branch/all, availability start/end, duration, quiz PIN, and repeatable Question + 4 Options + Correct Answer fields; save draft/publish. Per-quiz live analytics: participants, submitted count, average score, student scores, and question-wise accuracy.

Design: clean blue/purple modern school UI, mobile-first, rounded white cards. In the footer, create a real animated illustrated car—not just a moving icon—with rotating wheels, slight suspension/bounce, moving road lines, optional drifting clouds/background, and “RDX” visibly written on the car body. It should smoothly drive across the footer in a continuous loop using CSS/SVG only, with no animation library.

Add one demo 5-question quiz and sample students. No payments, chat, notifications, AI, email verification, or extra features.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://quiz-bloom-scoreboard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/636a37cf-3cd7-45a2-955a-503f2c1f4a05).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
