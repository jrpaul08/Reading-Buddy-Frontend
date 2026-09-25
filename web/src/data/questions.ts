/* Saved Q&A for a book. Mock entries only — replace when session save lands. */

export type SavedQuestion = {
  id: string;
  bookId: string;
  question: string;
  answer: string;
  chapter: number;
};

export const MOCK_QUESTIONS: SavedQuestion[] = [
  {
    id: "mock-raskolnikov-pawnbroker",
    bookId: "crime_and_punishment",
    question: "Why does Raskolnikov linger at the pawnbroker’s?",
    answer:
      "He is testing whether he can act on the idea, not just think it. The visit is a rehearsal, still before the crime.",
    chapter: 1,
  },
];

export function questionsForBook(bookId: string): SavedQuestion[] {
  return MOCK_QUESTIONS.filter((item) => item.bookId === bookId);
}
