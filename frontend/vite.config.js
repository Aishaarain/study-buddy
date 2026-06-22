import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600, // fixes the warning you saw
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'], // splits vendor bundle = faster load
        }
      }
    }
  }
})
