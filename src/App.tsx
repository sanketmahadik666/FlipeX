import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider as ReduxProvider } from "react-redux";
import { RecoilRoot } from "recoil";
import { lazy, Suspense } from "react";
import { store } from "@/store/store";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";

// Code splitting: lazy load route components for better bundle size
const Landing = lazy(() => import("./pages/Landing"));
const Upload = lazy(() => import("./pages/Upload"));
const ExperienceSelector = lazy(() => import("./pages/ExperienceSelector"));
const Reader = lazy(() => import("./pages/Reader"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ReduxProvider store={store}>
      <RecoilRoot>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<LoadingScreen message="Loading FlipeX..." />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/experience" element={<ExperienceSelector />} />
                  <Route path="/reader" element={<Reader />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </RecoilRoot>
    </ReduxProvider>
  </ErrorBoundary>
);

export default App;