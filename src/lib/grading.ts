export type GradeQuestion = { id: string; correct_index: number };

/** 1 point per correctly answered question. */
export function gradeAnswers(
  answers: Record<string, unknown>,
  questions: GradeQuestion[],
): number {
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] === q.correct_index) score += 1;
  }
  return score;
}
