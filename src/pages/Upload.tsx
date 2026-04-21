import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, AlertCircle, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadBook } from '@/lib/booksApi';
import { extractCoverFromPdf, getPdfPageCount } from '@/lib/coverExtractor';

const Upload = () => {
  const navigate = useNavigate();
  const [error, setLocalError] = useState<string | null>(null);

  // Form state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [coverBlob, setCoverBlob] = useState<Blob | undefined>();
  const [coverAuto, setCoverAuto] = useState(false);
  const [extractingCover, setExtractingCover] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [dragOverPdf, setDragOverPdf] = useState(false);

  // Upload state
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const coverInputRef = useRef<HTMLInputElement>(null);

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPdf(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePdfSelect(file);
  }, []);

  const handlePdfSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLocalError('Please upload a valid PDF file.');
      return;
    }
    setPdfFile(file);
    setLocalError(null);
    if (!title) {
      setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }
  };

  // Auto-extract cover (page 1) and page count whenever a new PDF is selected
  // and the user hasn't manually picked a cover.
  useEffect(() => {
    if (!pdfFile) return;
    let cancelled = false;
    (async () => {
      const count = await getPdfPageCount(pdfFile);
      if (!cancelled) setPageCount(count);

      // Only auto-extract if the user didn't already provide a cover
      if (coverBlob && !coverAuto) return;
      setExtractingCover(true);
      const cover = await extractCoverFromPdf(pdfFile);
      if (cancelled) return;
      if (cover) {
        setCoverImage(cover.dataUrl);
        setCoverBlob(cover.blob);
        setCoverAuto(true);
      }
      setExtractingCover(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile]);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Cover must be an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverImage(ev.target?.result as string);
      setCoverBlob(file);
      setCoverAuto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!pdfFile) {
      setLocalError('A PDF file is required to add a book.');
      return;
    }
    setSaving(true);
    setUploadPct(0);
    setLocalError(null);
    try {
      await uploadBook({
        pdf: pdfFile,
        cover: coverBlob,
        title: title || pdfFile.name.replace(/\.pdf$/i, ''),
        author: author || undefined,
        pageCount: pageCount ?? undefined,
        onProgress: setUploadPct,
      });
      navigate('/bookshelf');
    } catch (e: any) {
      console.error('Upload failed:', e);
      setLocalError(e?.message || 'Failed to upload book.');
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pt-12 pb-24">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground">Add to Library</h1>
          <p className="text-muted-foreground mt-2">Upload your PDF and customize its appearance on the bookshelf.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-upload-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card p-6 rounded-xl border border-border shadow-sm">

          {/* Cover */}
          <div className="md:col-span-1 flex flex-col gap-2">
            <div
              className="relative aspect-[2/3] w-full rounded-md border-2 border-dashed border-border bg-muted/30 overflow-hidden flex flex-col items-center justify-center group cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => coverInputRef.current?.click()}
              data-testid="dropzone-cover"
            >
              {coverImage ? (
                <>
                  <img src={coverImage} alt="Cover Preview" className="absolute inset-0 w-full h-full object-cover" data-testid="img-cover-preview" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change Cover</span>
                  </div>
                </>
              ) : extractingCover ? (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <span className="text-xs">Generating cover…</span>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground text-center px-4">Click to add poster</span>
                </>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleCoverSelect}
                title="Upload Cover Image"
                data-testid="input-cover"
              />
            </div>
            {coverAuto && coverImage && (
              <p className="text-[10px] text-muted-foreground text-center" data-testid="text-cover-auto-note">
                Auto-extracted from page 1. Click to replace.
              </p>
            )}
          </div>

          {/* Metadata + PDF */}
          <div className="md:col-span-2 space-y-5">

            <div>
              <label className="text-sm font-medium mb-1.5 block text-left">Book File (PDF) *</label>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOverPdf
                    ? 'border-primary bg-primary/5'
                    : pdfFile
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverPdf(true); }}
                onDragLeave={() => setDragOverPdf(false)}
                onDrop={handlePdfDrop}
              >
                {pdfFile ? (
                  <div className="flex items-center gap-3 text-green-600 dark:text-green-500" data-testid="text-pdf-selected">
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[200px]">{pdfFile.name}</span>
                      {pageCount != null && (
                        <span className="text-xs text-muted-foreground">{pageCount} pages</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <UploadIcon className="mb-2 h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Select PDF File</span>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePdfSelect(f);
                  }}
                  title="Upload PDF Book"
                  data-testid="input-pdf"
                />
              </label>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-left">Title</label>
              <Input
                placeholder="e.g. The Lord of the Rings"
                value={title}
                onChange={e => setTitle(e.target.value)}
                data-testid="input-title"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-left">Author</label>
              <Input
                placeholder="e.g. J.R.R. Tolkien"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                data-testid="input-author"
              />
            </div>

          </div>
        </div>

        {saving && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span>
              <span data-testid="text-upload-progress">{uploadPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full text-md"
            onClick={handleSubmit}
            disabled={!pdfFile || saving}
            data-testid="button-submit-upload"
          >
            {saving ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>
            ) : 'Add to Bookshelf'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/bookshelf')} disabled={saving} data-testid="button-cancel-upload">
            Cancel & Return to Library
          </Button>
        </div>

      </div>
    </div>
  );
};

export default Upload;
