import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error -- Local ESM server plugin for trusted scoring & leaderboard API
import { scoringBackendPlugin } from './server/scoringApiPlugin.js';

export default defineConfig({
  plugins: [react(), scoringBackendPlugin()],
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 250,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/database',
            'firebase/functions',
          ],
        },
      },
    },
  },
});
