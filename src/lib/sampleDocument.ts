// Sample document data generator for testing
export function generateSampleDocument() {
  const chapters = [
    {
      title: 'Introduction',
      pages: [
        {
          content: [
            'Welcome to FlipeX, your immersive reading experience.',
            'This sample document demonstrates the beautiful page-turning effects and reading modes available in FlipeX.',
            'In this introduction, we\'ll explore the features that make FlipeX special. From realistic page flips to customizable reading settings, everything is designed with your comfort in mind.',
            'The classic mode you\'re currently viewing mimics the experience of reading a physical book, complete with natural page-turning animations and depth effects.',
          ]
        },
        {
          content: [
            'FlipeX supports multiple reading modes to suit your preferences:',
            'Classic Mode offers a traditional book-like experience with page flips and spreads. Focus Mode presents one paragraph at a time for concentrated reading. Scroll Mode provides a continuous reading flow.',
            'Each mode is carefully crafted to reduce eye strain and enhance your reading comfort during long sessions.',
            'You can customize font size, line spacing, and even apply different themes to match your reading environment.',
          ]
        }
      ]
    },
    {
      title: 'Features',
      pages: [
        {
          content: [
            'FlipeX comes packed with features designed for modern readers.',
            'The page flip engine uses advanced 3D transforms to create realistic page-turning effects. Pages curl naturally, cast shadows, and respond to your interactions just like a real book.',
            'Navigation is intuitive: use arrow keys, click navigation buttons, or swipe on touch devices. Keyboard shortcuts make it easy to jump between pages and chapters.',
            'Zoom controls let you adjust the book size to your screen and preference, ensuring optimal readability on any device.',
          ]
        },
        {
          content: [
            'The reader automatically detects chapters from your PDF documents, creating a structured navigation experience.',
            'Hash-based URL navigation means you can bookmark specific pages and share them with others. The browser\'s back and forward buttons work as expected.',
            'For accessibility, FlipeX respects your system\'s motion preferences. If you have reduced motion enabled, page transitions become instant while maintaining full functionality.',
          ]
        },
        {
          content: [
            'Your reading progress is automatically saved, so you can pick up right where you left off.',
            'The interface adapts to mobile devices with a single-page layout optimized for smaller screens while maintaining the premium reading experience.',
            'Performance is a priority: smooth 60fps animations, efficient rendering, and minimal memory usage ensure FlipeX works great even on older devices.',
          ]
        }
      ]
    },
    {
      title: 'Getting Started',
      pages: [
        {
          content: [
            'Using FlipeX is simple and straightforward.',
            'Upload any PDF document through the upload page. FlipeX will automatically extract the text, detect chapters, and build optimized pages for the best reading experience.',
            'The processing happens entirely in your browser - your documents never leave your device, ensuring complete privacy.',
            'Once processed, choose your preferred reading mode and start enjoying your book with beautiful page-turning effects.',
          ]
        },
        {
          content: [
            'Keyboard shortcuts make navigation effortless:',
            'Press the Right Arrow or Space to go to the next page. Press the Left Arrow to go back. Use the Plus and Minus keys to zoom in and out.',
            'The Settings panel lets you customize font size and line spacing to match your preferences. Experiment with different combinations to find what works best for you.',
          ]
        }
      ]
    },
    {
      title: 'Advanced Features',
      pages: [
        {
          content: [
            'For power users, FlipeX offers advanced capabilities.',
            'The reader intelligently handles multi-column layouts, automatically detecting and processing text in the correct reading order.',
            'Page numbers, headers, and footers are automatically filtered out to provide a clean reading experience focused on the content that matters.',
            'The pagination engine prevents widows and orphans, ensuring text flows naturally across pages just like professionally typeset books.',
          ]
        },
        {
          content: [
            'FlipeX supports responsive design principles throughout.',
            'On desktop, enjoy two-page spreads that recreate the open-book experience. On tablets and phones, switch seamlessly to single-page view optimized for portrait orientation.',
            'Touch gestures work intuitively: swipe to turn pages, pinch to zoom, and tap navigation areas for quick access to controls.',
          ]
        },
        {
          content: [
            'The sound effects add an extra layer of immersion to your reading.',
            'Subtle audio cues accompany page turns, enhancing the tactile feel of the digital book. These can be muted if you prefer silent reading.',
            'Every detail is crafted to create a premium reading experience that rivals and often exceeds physical books.',
          ]
        }
      ]
    },
    {
      title: 'Conclusion',
      pages: [
        {
          content: [
            'Thank you for trying FlipeX!',
            'We hope this sample demonstrates the care and attention to detail that went into creating this reading experience.',
            'Whether you\'re reading novels, textbooks, or technical documents, FlipeX adapts to your needs with elegant simplicity and powerful features.',
            'Upload your own PDF to experience the magic of FlipeX with your favorite books and documents.',
          ]
        },
        {
          content: [
            'FlipeX is continuously evolving with new features and improvements.',
            'Future updates will bring even more customization options, reading modes, and enhancements based on user feedback.',
            'We believe reading should be a joy, not a chore. FlipeX is our contribution to making digital reading as comfortable and engaging as possible.',
            'Happy reading!',
          ]
        }
      ]
    }
  ];

  // Calculate totals
  const totalPages = chapters.reduce((sum, ch) => sum + ch.pages.length, 0);
  const totalParagraphs = chapters.reduce((sum, ch) => 
    sum + ch.pages.reduce((pSum, p) => pSum + p.content.length, 0), 
  0);

  return {
    id: 'sample-doc-' + Date.now(),
    title: 'The Art of Reading',
    author: 'FlipeX Demo',
    createdAt: new Date().toISOString(),
    totalPages,
    totalParagraphs,
    chapters
  };
}
