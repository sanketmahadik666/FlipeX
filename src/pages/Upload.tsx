import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useSetRecoilState } from 'recoil';
import { Upload as UploadIcon, FileText, AlertCircle } from 'lucide-react';
import { processPDF } from '@/lib/pdfProcessor';
import { setStatus, setCurrentDocumentId, setError } from '@/store/appSlice';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const Upload = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const setDocument = useSetRecoilState(processedDocumentAtom);
  const [processing, setProcessing] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLocalError('Please upload a PDF file.');
      return;
    }

    setProcessing(true);
    setLocalError(null);
    dispatch(setStatus('processing'));

    try {
      const doc = await processPDF(file);
      setDocument(doc);
      dispatch(setCurrentDocumentId(doc.id));
      dispatch(setStatus('ready'));
      navigate('/experience');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to process PDF.';
      setLocalError(msg);
      dispatch(setError(msg));
      setProcessing(false);
    }
  }, [dispatch, navigate, setDocument]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (processing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <FileText className="mx-auto h-12 w-12 text-primary animate-pulse" />
          <h2 className="font-serif text-2xl font-semibold text-foreground">Processing your book…</h2>
          <p className="text-muted-foreground">Extracting text, detecting chapters, building pages</p>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-5/6 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg space-y-6 text-center">
        <h1 className="font-serif text-3xl font-bold text-foreground">Upload Your Book</h1>
        <p className="text-muted-foreground">Drop a PDF file to begin your reading experience</p>

        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-card'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <UploadIcon className="mb-4 h-10 w-10 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Drag & drop your PDF here
          </span>
          <span className="mt-1 text-xs text-muted-foreground">or click to browse</span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={onFileSelect}
          />
        </label>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Back
        </Button>
      </div>
    </div>
  );
};

export default Upload;