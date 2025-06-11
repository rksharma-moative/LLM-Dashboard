/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.{html,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#2c2e33',
        },
        background: {
          DEFAULT: '#f3f4f6',
          dark: '#1a1b1e',
        }
      },
      fontFamily: {
        sans: ['FKGroteskNeue', 'Inter', 'sans-serif'],
        mono: ['Berkeley Mono', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
