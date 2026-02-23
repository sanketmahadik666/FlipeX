import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useSetRecoilState } from 'recoil';
import { Upload as UploadIcon, FileText, AlertCircle, BookOpen } from 'lucide-react';
import { processPDFInWorker } from '@/lib/pipeline/pipelineWorkerClient';
import { generateSampleDocument } from '@/lib/sampleDocument';
import { setStatus, setCurrentDocumentId, setError } from '@/store/appSlice';
import { processedDocumentAtom } from '@/state/recoilAtoms';
import { Button } from '@/components/ui/button';

const Upload = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const setDocument = useSetRecoilState(processedDocumentAtom);
  const [processing, setProcessing] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressDetail, setProgressDetail] = useState('');

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setLocalError('Please upload a PDF file.');
      return;
    }

    setProcessing(true);
    setLocalError(null);
    setProgressStage('');
    setProgressPercent(0);
    setProgressDetail('');
    dispatch(setStatus('processing'));

    try {
      const doc = await processPDFInWorker(
        file,
        (stage, percent, detail) => {
          setProgressStage(stage);
          setProgressPercent(percent);
          setProgressDetail(detail || '');
        }
      );
      setDocument(doc as any);
      dispatch(setCurrentDocumentId(doc.id));
      dispatch(setStatus('ready'));
      navigate('/experience');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to process PDF.';
      setLocalError(msg);
      dispatch(setError(msg));
      setProcessing(false);
      setProgressStage('');
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

  const loadSampleDocument = useCallback(async () => {
    setProcessing(true);
    setLocalError(null);
    dispatch(setStatus('processing'));

    try {
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
    // Calculate stroke dashoffset for circular progress
    const circumference = 264;
    const dashoffset = circumference - (progressPercent / 100) * circumference;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <h2 className="font-serif text-2xl font-semibold text-foreground">Processing your book…</h2>
          <p className="text-muted-foreground">{progressStage || 'Analyzing document structure'}</p>
          
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
                
                {/* Progress Circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${circumference} ${circumference}`}
                  className="text-primary transition-all duration-500 ease-out"
                  strokeLinecap="round"
                  style={{ strokeDashoffset: dashoffset }}
                />
              </svg>
              
              {/* Center: Percentage */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
              </div>
            </div>
          </div>

          {/* Progress Detail */}
          {progressDetail && (
            <div className="mt-4 rounded-lg bg-muted/50 backdrop-blur-sm border border-border p-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                </div>
                <p className="text-sm text-foreground font-mono flex-1">
                  {progressDetail}
                </p>
              </div>
            </div>
          )}
          
          {/* Processing Steps */}
          {!progressDetail && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <span>Analyzing document structure</span>
              </div>
            </div>
          )}
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