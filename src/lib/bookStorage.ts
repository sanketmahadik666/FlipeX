/**
 * bookStorage.ts — IndexedDB persistence layer for the user's personal library.
 * 
 * Stores uploaded PDFs (as File blobs) and cover images (as data URLs)
 * so the library survives page refreshes without needing a backend server.
 * 
 * Uses the raw IndexedDB API — zero dependencies.
 */

const DB_NAME = 'FlipeXLibrary';
const DB_VERSION = 1;
const STORE_NAME = 'books';

export interface StoredBook {
  id: string;
  title: string;
  author: string;
  coverImage?: string;   // base64 data URL
  pdfBlob?: Blob;        // the actual PDF binary
  pdfFileName?: string;  // original filename for display
  createdAt: number;      // timestamp
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save a book (with PDF blob + cover) into IndexedDB */
export async function saveBook(book: {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  file?: File;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredBook = {
      id: book.id,
      title: book.title,
      author: book.author,
      coverImage: book.coverImage,
      pdfBlob: book.file,
      pdfFileName: book.file?.name,
      createdAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Load all books from IndexedDB */
export async function loadAllBooks(): Promise<StoredBook[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      db.close();
      resolve(req.result as StoredBook[]);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Delete a book from IndexedDB by id */
export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Get a single book by id (useful for retrieving the PDF blob) */
export async function getBook(id: string): Promise<StoredBook | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
      db.close();
      resolve(req.result as StoredBook | undefined);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
