import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@xterm/addon-webgl')) {
            return 'xterm-webgl'
          }
          if (id.includes('@xterm/')) {
            return 'xterm-vendor'
          }
          if (id.includes('react-markdown')) {
            return 'markdown-vendor'
          }
        },
      },
    },
  },
})
