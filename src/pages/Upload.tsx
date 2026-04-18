import React, { useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { Upload as UploadIcon, AlertCircle, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { userLibraryAtom } from '@/state/recoilAtoms';

const Upload = () => {
  const navigate = useNavigate();
  const setUserLibrary = useSetRecoilState(userLibraryAtom);
  const [error, setLocalError] = useState<string | null>(null);

  // Form State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [dragOverPdf, setDragOverPdf] = useState(false);

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
    
    // Auto-fill title from filename if empty
    if (!title) {
      setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setLocalError('Cover must be an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!pdfFile) {
      setLocalError('A PDF file is required to add a book.');
      return;
    }

    const newBook = {
      id: `user-book-${Date.now()}`,
      title: title || 'Untitled Book',
      author: author || 'Unknown Author',
      coverImage: coverImage,
      file: pdfFile
    };

    // Add to library and navigate
    setUserLibrary((prev) => [...prev, newBook]);
    navigate('/bookshelf');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pt-12 pb-24">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground">Add to Library</h1>
          <p className="text-muted-foreground mt-2">Upload your PDF and customize its appearance on the bookshelf.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card p-6 rounded-xl border border-border shadow-sm">
          
          {/* Cover Image Upload (Left Column) */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <div 
              className="relative aspect-[2/3] w-full rounded-md border-2 border-dashed border-border bg-muted/30 overflow-hidden flex flex-col items-center justify-center group cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverImage ? (
                <>
                  <img src={coverImage} alt="Cover Preview" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">Change Cover</span>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground text-center px-4">Click to add poster</span>
                </>
              )}
              <input 
                type="file" 
                ref={coverInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleCoverSelect} 
              />
            </div>
          </div>

          {/* Metadata & PDF (Right Column) */}
          <div className="md:col-span-2 space-y-5">
            
            {/* PDF Dropzone */}
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
                  <div className="flex items-center gap-3 text-green-600 dark:text-green-500">
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                    <span className="text-sm font-medium truncate max-w-[200px]">{pdfFile.name}</span>
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
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePdfSelect(f);
                  }}
                />
              </label>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-left">Title</label>
              <Input 
                placeholder="e.g. The Lord of the Rings" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-left">Author</label>
              <Input 
                placeholder="e.g. J.R.R. Tolkien" 
                value={author} 
                onChange={e => setAuthor(e.target.value)} 
              />
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            size="lg" 
            className="w-full text-md" 
            onClick={handleSubmit}
            disabled={!pdfFile}
          >
            Add to Bookshelf
          </Button>
          <Button variant="ghost" onClick={() => navigate('/bookshelf')}>
            Cancel & Return to Library
          </Button>
        </div>

      </div>
    </div>
  );
};

export default Upload;