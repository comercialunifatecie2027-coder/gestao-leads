/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff6ed', 100: '#ffead4', 200: '#ffd1a8', 300: '#ffb070', 400: '#ff8a3d',
          500: '#f26b1d', 600: '#e05412', 700: '#b93f10', 800: '#933315', 900: '#772d14',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};
