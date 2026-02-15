import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize bundle size
    target: 'es2015',
    minify: 'terser',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and smaller initial load
        manualChunks: {
          // React core
          'react-core': ['react', 'react-dom', 'react/jsx-runtime'],
          // React Router
          'react-router': ['react-router-dom'],
          // State Management
          'state-management': ['recoil', 'jotai', '@reduxjs/toolkit', 'react-redux'],
          // UI Library - Radix UI components
          'ui-radix': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-slider',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // UI Library - Other UI components
          'ui-components': [
            'lucide-react',
            'sonner',
            'cmdk',
            'class-variance-authority',
            'tailwind-merge',
          ],
          // React Query
          'react-query': ['@tanstack/react-query'],
          // PDF.js - largest dependency
          'pdfjs': ['pdfjs-dist'],
          // Tesseract OCR - large dependency
          'tesseract': ['tesseract.js'],
          // Page flip library
          'pageflip': ['react-pageflip-enhanced'],
        },
      },
    },
    // Chunk size warning limit
    chunkSizeWarningLimit: 600,
  },
}));
