import React, { useRef, useState } from 'react';
import { grabBook } from '@/animations/bookGrab';
import { BookOpen } from 'lucide-react';

interface BookCardProps {
  title: string;
  author: string;
  coverImage?: string;
  onGrabCompleted: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ title, author, coverImage, onGrabCompleted }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coverError, setCoverError] = useState(false);

  const handleClick = () => {
    if (!cardRef.current) return;
    const parent = cardRef.current.parentElement;
    const siblings: HTMLElement[] = parent
      ? (Array.from(parent.querySelectorAll<HTMLElement>('.book-card')).filter(c => c !== cardRef.current))
      : [];
    grabBook(cardRef.current, siblings, onGrabCompleted);
  };

  const showCover = coverImage && !coverError;

  return (
    <div
      ref={cardRef}
      className="book-card relative flex h-64 w-44 cursor-pointer flex-col justify-end overflow-hidden rounded-md bg-white shadow-lg transition-shadow hover:shadow-xl dark:bg-zinc-800"
      onClick={handleClick}
      data-testid={`card-book-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {/* Book Cover */}
      {showCover ? (
        <img
          src={coverImage}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverError(true)}
          data-testid="img-book-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700">
          <BookOpen className="h-12 w-12 text-zinc-400" />
        </div>
      )}

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Book details */}
      <div className="relative p-4 text-white">
        <h3 className="line-clamp-2 text-sm font-semibold" data-testid="text-book-title">{title}</h3>
        <p className="mt-1 truncate text-xs font-light text-zinc-300" data-testid="text-book-author">{author}</p>
      </div>
    </div>
  );
};
