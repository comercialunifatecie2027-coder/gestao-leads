import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          export: ['xlsx', 'jspdf', 'jspdf-autotable'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: { environment: 'node' },
} as any);
