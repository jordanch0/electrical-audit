import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/electrical-audit/',
  server: {
    host: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
