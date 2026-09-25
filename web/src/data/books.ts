/* The book catalog — ported from the Gradio app's BOOKS list (app.py).
   This is the single source of truth for what appears on the shelf. Chapter
   counts/years are sensible real values for these public-domain works and can
   be edited freely. */

export type Book = {
  id: string;
  title: string;
  author: string;
  year: string;
  chapters: number;
  cover: string; // filename served from /covers (see web/public/covers)
};

export const BOOKS: Book[] = [
  {
    id: "crime_and_punishment",
    title: "Crime and Punishment",
    author: "Fyodor Dostoevsky",
    year: "1866",
    chapters: 39,
    cover: "crime_and_punishment.jpeg",
  },
  {
    id: "the_idiot",
    title: "The Idiot",
    author: "Fyodor Dostoevsky",
    year: "1869",
    chapters: 51,
    cover: "the_idiot.jpeg",
  },
  {
    id: "the_count_of_monte_cristo",
    title: "The Count of Monte Cristo",
    author: "Alexandre Dumas",
    year: "1846",
    chapters: 117,
    cover: "the_count_of_monte_cristo.jpeg",
  },
  {
    id: "pride_and_prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    year: "1813",
    chapters: 61,
    cover: "pride_and_prejudice.jpeg",
  },
];

export const BOOKS_BY_ID: Record<string, Book> = Object.fromEntries(
  BOOKS.map((book) => [book.id, book])
);

/* Cover art lives in web/public/covers and is served from the site root.
   Filenames are URL-safe (lowercase, underscores) so no encoding is needed. */
export function coverUrl(book: Book): string {
  return `/covers/${book.cover}`;
}
