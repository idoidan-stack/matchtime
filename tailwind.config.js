/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e0faf9',
          100: '#b3f3f0',
          400: '#26ddd4',
          500: '#00D4C8',
          600: '#00bab0',
          700: '#009e95',
          800: '#007a72',
          900: '#003B5C',
        },
      },
    },
  },
  plugins: [],
}
