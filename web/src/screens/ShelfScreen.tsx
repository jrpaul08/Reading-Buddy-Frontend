import { useNavigate } from "react-router-dom";
import { BOOKS, coverUrl, type Book } from "../data/books";

/* Decorative divider (❦) used above and below the intro copy. */
function Ornament() {
  return (
    <div className="ornament">
      <span className="ornament__line" />
      <span className="ornament__dot">{"\u2766"}</span>
      <span className="ornament__line" />
    </div>
  );
}

/* VIEW 1: the shelf. Pick a book to open its session setup. The chosen book's
   id travels in the URL (/setup/:bookId) so the next page can look it up. */
export default function ShelfScreen() {
  const navigate = useNavigate();
  const openSetup = (book: Book) => navigate(`/setup/${book.id}`);

  return (
    <section className="view view--shelf is-active" data-view="shelf">
      <div className="shelf__intro">
        <Ornament />
        <h1 className="brand-title">READING BUDDY</h1>
        <p className="shelf__tagline">
          The Quiet Companion That Reads Alongside You
        </p>
        <p className="lede">
          Choose a volume from the shelf and begin your reading session. When a
          question stirs, simply speak and receive spoiler-free answers.
        </p>
        <Ornament />
      </div>

      <p className="label-caps shelf__label">Your Shelf</p>
      <div className="shelf__case">
        <div className="shelf__row" id="shelf-row">
          {BOOKS.map((book) => (
            <button
              key={book.id}
              className="shelf__book"
              onClick={() => openSetup(book)}
              aria-label={`Open ${book.title}`}
            >
              <div className="book-cover">
                <img
                  className="book-cover__img"
                  src={coverUrl(book)}
                  alt={`${book.title} cover`}
                />
              </div>
            </button>
          ))}
        </div>
        <div className="shelf__ledge" aria-hidden="true" />
      </div>
    </section>
  );
}
