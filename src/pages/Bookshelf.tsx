import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useDispatch } from 'react-redux';
import { useSetRecoilState } from 'recoil';

import { BookCard } from '@/components/BookCard';
import { GRAB_CONFIG } from '@/animations/bookGrab.config';
import { generateSampleDocument } from '@/lib/sampleDocument';
import { setStatus, setCurrentDocumentId } from '@/store/appSlice';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import '@/animations/bookGrab.css'; // Make sure the 3D perspective CSS is loaded!

// Mock Library
const MOCK_LIBRARY = [
  { id: '1', title: 'The Antigravity Handbook', author: 'Dr. Float' },
  { id: '2', title: 'Quantum Kinetics', author: 'Marie Physics' },
  { id: '3', title: 'A Short History of Nearly Everything', author: 'Bill Bryson' },
  { id: '4', title: 'Cosmos', author: 'Carl Sagan' },
  { id: '5', title: 'GSAP Animation Strategies', author: 'Frontend Guru' },
];

export default function Bookshelf() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const setDocument = useSetRecoilState(processedDocumentAtom);
  const gridRef = useRef<HTMLDivElement>(null);

  // Initialize ambient float animation
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.book-card');
    
    // Antigravity: idle levitation loop
    const ambientTweens = gsap.to(cards, {
      y:        GRAB_CONFIG.AMBIENT_FLOAT_Y,
      duration: GRAB_CONFIG.AMBIENT_FLOAT_DURATION,
      ease:     GRAB_CONFIG.AMBIENT_FLOAT_EASE,
      repeat:   GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo:     GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger:  0.12,
    });

    return () => {
      // Cleanup on unmount
      ambientTweens.kill();
    };
  }, []);

  // What happens when a book finishes grabbed?
  const handleBookSelected = async (bookId: string) => {
    // Generate/fetch the document
    dispatch(setStatus('processing'));
    await new Promise(resolve => setTimeout(resolve, 300));
    const doc = generateSampleDocument();
    
    // Patch title just to show it worked
    doc.title = MOCK_LIBRARY.find(b => b.id === bookId)?.title || doc.title;

    setDocument(doc);
    dispatch(setCurrentDocumentId(doc.id));
    dispatch(setStatus('ready'));
    
    // Navigate completely to experience reader
    navigate('/experience');
  };

  return (
    <div id="drawer" className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 sm:p-12">
      <div className="mb-12 text-center text-zinc-100">
        <h1 className="text-4xl font-serif font-medium drop-shadow-md">Your Library</h1>
        <p className="mt-2 text-zinc-400">Select a book to start reading (Antigravity enabled)</p>
      </div>

      {/* The 3D Preserve context wrapper */}
      <div 
        ref={gridRef} 
        className="book-grid is-antigravity flex flex-wrap justify-center gap-8 md:gap-12 w-full max-w-6xl p-8 rounded-xl"
      >
        {MOCK_LIBRARY.map((book) => (
          <BookCard 
            key={book.id}
            title={book.title}
            author={book.author}
            onGrabCompleted={() => handleBookSelected(book.id)}
          />
        ))}
      </div>
    </div>
  );
}
