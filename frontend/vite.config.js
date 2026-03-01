import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const toGlob = (p) => p.replace(/\\/g, '/')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            toGlob(join(__dirname, 'index.html')),
            toGlob(join(__dirname, 'src/**/*.{js,ts,jsx,tsx}')),
          ],
          theme: { extend: {} },
          plugins: [],
        }),
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
