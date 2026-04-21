/**
 * booksApi.ts — REST client for the backend book library.
 * Replaces the prior IndexedDB persistence layer.
 */

export interface ApiBook {
  id: string;
  title: string;
  author: string;
  pdfFileName: string;
  pdfSize: number;
  pageCount: number | null;
  hasCover: boolean;
  coverUrl: string | null;
  pdfUrl: string;
  createdAt: string;
}

export interface BookListResponse {
  items: ApiBook[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listBooks(page = 1, pageSize = 20): Promise<BookListResponse> {
  const res = await fetch(`/api/books?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) throw new Error(`listBooks failed: ${res.status}`);
  return res.json();
}

export async function getBook(id: string): Promise<ApiBook> {
  const res = await fetch(`/api/books/${id}`);
  if (!res.ok) throw new Error(`getBook failed: ${res.status}`);
  return res.json();
}

export async function uploadBook(opts: {
  pdf: File;
  cover?: Blob | File;
  title: string;
  author?: string;
  pageCount?: number;
  onProgress?: (pct: number) => void;
}): Promise<ApiBook> {
  const fd = new FormData();
  fd.append("pdf", opts.pdf);
  if (opts.cover) {
    const coverFile =
      opts.cover instanceof File
        ? opts.cover
        : new File([opts.cover], "cover.png", { type: opts.cover.type || "image/png" });
    fd.append("cover", coverFile);
  }
  fd.append("title", opts.title);
  if (opts.author) fd.append("author", opts.author);
  if (opts.pageCount != null) fd.append("pageCount", String(opts.pageCount));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
}

export async function deleteBook(id: string): Promise<void> {
  const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteBook failed: ${res.status}`);
}

/**
 * Fetch a book's PDF as an ArrayBuffer.
 * The server supports HTTP Range, so PDF.js can later fetch additional ranges
 * directly via the same URL when used with `getDocument({ url, ... })`.
 */
export async function fetchPdfBuffer(pdfUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`fetchPdf failed: ${res.status}`);
  return res.arrayBuffer();
}
