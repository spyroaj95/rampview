import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative so the static build works on
// Vercel, Netlify, and GitHub Pages (project subpaths) with zero config.
export default defineConfig({
  plugins: [react()],
  base: './',
  // react-globe.gl and three-globe each pull three; force a single copy so
  // the WebGL scene's instanceof checks pass and the globe actually renders.
  resolve: {
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three', 'react-globe.gl'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Keep the heavy three.js / globe engine in its own long-cached chunk.
        manualChunks: {
          globe: ['three', 'react-globe.gl'],
        },
      },
    },
  },
})
