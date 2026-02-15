import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useSetRecoilState } from 'recoil';
import { Upload as UploadIcon, FileText, AlertCircle, BookOpen, Image as ImageIcon } from 'lucide-react';
import { processPDF } from '@/lib/pdfProcessor';
import { processPDFAsImages } from '@/lib/pdfPageRenderer';
import { generateSampleDocument } from '@/lib/sampleDocument';
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
  const [ocrProgress, setOCRProgress] = useState<string>('');
  const [imageMode, setImageMode] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLocalError('Please upload a PDF file.');
      return;
    }

    setProcessing(true);
    setLocalError(null);
    setOCRProgress('');
    dispatch(setStatus('processing'));

    try {
      let doc;
      if (imageMode) {
        // Render PDF pages as images (exact layout)
        doc = await processPDFAsImages(file, (progress) => {
          setOCRProgress(progress);
        });
      } else {
        // Extract text and build pages
        doc = await processPDF(file, (progress) => {
          setOCRProgress(progress);
        });
      }
      setDocument(doc);
      dispatch(setCurrentDocumentId(doc.id));
      dispatch(setStatus('ready'));
      setOCRProgress('');
      navigate('/experience');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to process PDF.';
      setLocalError(msg);
      dispatch(setError(msg));
      setProcessing(false);
      setOCRProgress('');
    }
  }, [dispatch, navigate, setDocument, imageMode]);

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

  const loadSampleDocument = useCallback(async () => {
    setProcessing(true);
    setLocalError(null);
    dispatch(setStatus('processing'));

    try {
      // Simulate processing delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const doc = generateSampleDocument();
      setDocument(doc);
      dispatch(setCurrentDocumentId(doc.id));
      dispatch(setStatus('ready'));
      navigate('/experience');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load sample document.';
      setLocalError(msg);
      dispatch(setError(msg));
      setProcessing(false);
    }
  }, [dispatch, navigate, setDocument]);

  if (processing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <h2 className="font-serif text-2xl font-semibold text-foreground">Processing your book…</h2>
          <p className="text-muted-foreground">Extracting text, detecting chapters, building pages</p>
          
          {/* Circular Progress Display */}
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
                {/* Background Circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/20"
                  strokeLinecap="round"
                />
                
                {/* Animated Progress Circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray="264 264"
                  className="text-primary animate-pulse"
                  strokeLinecap="round"
                  style={{
                    animation: 'dash 2s ease-in-out infinite',
                  }}
                />
              </svg>
              
              {/* Center Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-12 h-12 text-primary animate-pulse" />
              </div>
            </div>
          </div>

          {/* OCR Progress Messages */}
          {ocrProgress && (
            <div className="mt-4 rounded-lg bg-muted/50 backdrop-blur-sm border border-border p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                </div>
                <p className="text-sm text-foreground font-mono flex-1">
                  {ocrProgress}
                </p>
              </div>
              
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <span>💡</span>
                <p>Scanned PDFs use OCR and may take longer to process</p>
              </div>
            </div>
          )}
          
          {/* Processing Steps */}
          {!ocrProgress && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <span>Analyzing document structure</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Add animation keyframes */}
        <style>{`
          @keyframes dash {
            0% { stroke-dashoffset: 264; }
            50% { stroke-dashoffset: 132; }
            100% { stroke-dashoffset: 264; }
          }
        `}</style>
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={loadSampleDocument}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Try Sample Document
        </Button>

        <Button variant="ghost" onClick={() => navigate('/')}>          ← Back
        </Button>
      </div>
    </div>
  );
};

export default Upload;