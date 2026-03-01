import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const toGlob = (p) => p.replace(/\\/g, '/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    toGlob(join(__dirname, "index.html")),
    toGlob(join(__dirname, "src/**/*.{js,ts,jsx,tsx}")),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
