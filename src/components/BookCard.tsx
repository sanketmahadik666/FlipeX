import React, { useRef } from 'react';
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

  const handleClick = () => {
    if (!cardRef.current) return;
    
    // Find siblings within the same parent bookshelf grid
    const parent = cardRef.current.parentElement;
    let siblings: HTMLElement[] = [];
    if (parent) {
      const allCards = Array.from(parent.querySelectorAll('.book-card')) as HTMLElement[];
      const currentIndex = allCards.indexOf(cardRef.current);
      // Grab siblings after this one (for the levitation wave effect)
      siblings = allCards.slice(currentIndex + 1);
    }

    // Fire the animation
    grabBook(cardRef.current, siblings, onGrabCompleted);
  };

  return (
    <div 
      ref={cardRef} 
      className="book-card relative flex h-64 w-44 cursor-pointer flex-col justify-end overflow-hidden rounded-md bg-white shadow-lg transition-shadow hover:shadow-xl dark:bg-zinc-800"
      onClick={handleClick}
    >
      {/* Book Cover */}
      {coverImage ? (
        <img src={coverImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700">
          <BookOpen className="h-12 w-12 text-zinc-400" />
        </div>
      )}
      
      {/* Gradient Overlay for Text Readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
      
      {/* Book Details */}
      <div className="relative p-4 text-white">
        <h3 className="line-clamp-2 text-sm font-semibold">{title}</h3>
        <p className="mt-1 truncate text-xs font-light text-zinc-300">{author}</p>
      </div>
    </div>
  );
};
