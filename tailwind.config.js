/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
      },
      fontFamily: {
        sans: ["'Geist Variable'", "system-ui", "'Segoe UI'", "Roboto", "sans-serif"],
        heading: ["'Geist Variable'", "system-ui", "'Segoe UI'", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
}