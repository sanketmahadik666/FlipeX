import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="max-w-2xl text-center space-y-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="font-serif text-5xl font-bold tracking-tight text-foreground md:text-6xl">
          Rediscover Reading
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
          Transform any PDF into an immersive, book-like reading experience.
          Page by page. Mode by mode. The way reading was meant to feel.
        </p>
        <Button
          size="lg"
          className="text-lg px-10 py-6 rounded-lg"
          onClick={() => navigate('/upload')}
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Landing;