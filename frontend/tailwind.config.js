/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6', // Biru utama
          600: '#2563eb', // Biru hover
          900: '#1e3a8a',
        }
      }
    },
  },
  plugins: [],
}