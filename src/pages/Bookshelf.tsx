import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useDispatch } from 'react-redux';
import { useSetRecoilState, useRecoilValue } from 'recoil';

import { BookCard } from '@/components/BookCard';
import { GRAB_CONFIG } from '@/animations/bookGrab.config';
import { generateSampleDocument } from '@/lib/sampleDocument';
import { setStatus, setCurrentDocumentId } from '@/store/appSlice';
import { processedDocumentAtom, userLibraryAtom } from '@/state/recoilAtoms';
import { processPDFInWorker } from '@/lib/pipeline/pipelineWorkerClient';
import '@/animations/bookGrab.css';

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
  const userLibrary = useRecoilValue(userLibraryAtom);
  const gridRef = useRef<HTMLDivElement>(null);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');

  // Combine libraries
  const allBooks = [...userLibrary, ...MOCK_LIBRARY];

  // Initialize ambient float animation
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.book-card');
    
    const ambientY = gsap.to(cards, {
      y:        GRAB_CONFIG.AMBIENT_FLOAT_Y,
      duration: GRAB_CONFIG.AMBIENT_FLOAT_DURATION,
      ease:     GRAB_CONFIG.AMBIENT_FLOAT_EASE,
      repeat:   GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo:     GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger:  { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER, from: "random" as any },
    });

    const ambientSway = gsap.to(cards, {
      rotationZ: GRAB_CONFIG.AMBIENT_FLOAT_ROT_Z,
      duration: GRAB_CONFIG.AMBIENT_SWAY_DURATION,
      ease:     GRAB_CONFIG.AMBIENT_SWAY_EASE,
      repeat:   GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo:     GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger:  { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER, from: "random" as any },
    });

    const ambientBreathe = gsap.to(cards, {
      scale:    GRAB_CONFIG.AMBIENT_FLOAT_SCALE,
      duration: GRAB_CONFIG.AMBIENT_BREATHE_SCALE_DURATION,
      ease:     GRAB_CONFIG.AMBIENT_FLOAT_EASE,
      repeat:   GRAB_CONFIG.AMBIENT_FLOAT_REPEAT,
      yoyo:     GRAB_CONFIG.AMBIENT_FLOAT_YOYO,
      stagger:  { each: GRAB_CONFIG.AMBIENT_FLOAT_STAGGER, from: "random" as any },
    });

    return () => {
      ambientY.kill();
      ambientSway.kill();
      ambientBreathe.kill();
    };
  }, [allBooks.length]); // Re-run if books change

  const handleBookSelected = async (bookId: string) => {
    dispatch(setStatus('processing'));
    
    const userBook = userLibrary.find(b => b.id === bookId);
    
    if (userBook && userBook.file) {
      setProcessing(true);
      setProgressStage('');
      setProgressPercent(0);
      setProgressDetail('');
      
      try {
        const doc = await processPDFInWorker(
          userBook.file,
          (stage, percent, detail) => {
            setProgressStage(stage);
            setProgressPercent(percent);
            setProgressDetail(detail || '');
          }
        );
        doc.title = userBook.title || doc.title;
        setDocument(doc as any);
        dispatch(setCurrentDocumentId(doc.id));
        dispatch(setStatus('ready'));
        navigate('/experience');
      } catch (e) {
        console.error("Pipeline failed processing PDF:", e);
        dispatch(setStatus('error'));
        setProcessing(false);
      }
      return;
    }

    // Mock book fallback
    await new Promise(resolve => setTimeout(resolve, 300));
    const doc = generateSampleDocument();
    doc.title = MOCK_LIBRARY.find(b => b.id === bookId)?.title || doc.title;

    setDocument(doc);
    dispatch(setCurrentDocumentId(doc.id));
    dispatch(setStatus('ready'));
    navigate('/experience');
  };

  const circumference = 264;
  const dashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div id="drawer" className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 sm:p-12">
      
      {/* PROCESSING OVERLAY */}
      {processing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6 animate-in fade-in duration-500">
          <div className="w-full max-w-md space-y-6 text-center">
            <h2 className="font-serif text-2xl font-semibold text-foreground">Processing your book…</h2>
            <p className="text-muted-foreground">{progressStage || 'Analyzing document structure'}</p>
            
            <div className="flex justify-center py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl" />
                <svg
                  className="transform -rotate-90"
                  width="160"
                  height="160"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/20" strokeLinecap="round" />
                  <circle
                    cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={`${circumference} ${circumference}`}
                    className="text-primary transition-all duration-500 ease-out"
                    strokeLinecap="round"
                    style={{ strokeDashoffset: dashoffset }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
                </div>
              </div>
            </div>

            {progressDetail && (
              <div className="mt-4 rounded-lg bg-muted/50 backdrop-blur-sm border border-border p-4 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </div>
                  <p className="text-sm text-foreground font-mono flex-1">{progressDetail}</p>
                </div>
              </div>
            )}
            
            {!progressDetail && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                  <span>Analyzing pipeline components</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NORMAL SHELF UI */}
      <div className="mb-12 text-center text-zinc-100">
        <h1 className="text-4xl font-serif font-medium drop-shadow-md">Your Library</h1>
        <p className="mt-2 text-zinc-400">Select a book to start reading (Antigravity enabled)</p>
        <button 
          onClick={() => navigate('/upload')}
          className="mt-6 rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 border border-zinc-700"
        >
          + Add New Book
        </button>
      </div>

      <div 
        ref={gridRef} 
        className="book-grid is-antigravity flex flex-wrap justify-center gap-8 md:gap-12 w-full max-w-6xl p-8 rounded-xl"
      >
        {allBooks.map((book) => (
          <BookCard 
            key={book.id}
            title={book.title}
            author={book.author}
            coverImage={book.coverImage}
            onGrabCompleted={() => handleBookSelected(book.id)}
          />
        ))}
      </div>
    </div>
  );
}
