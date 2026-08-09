/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#7A8B6F',
        'primary-dark': '#5F6E54',
        'primary-light': '#96A58B',
        'bg-main': '#F3EDE4',
        'bg-sidebar': '#2B2B2B',
        'bg-sidebar-hover': '#3A3A3A',
        'bg-sidebar-active': '#4A5A40',
        'text-main': '#2B2B2B',
        'text-secondary': '#6B6B6B',
        'warning': '#E8B923',
        'danger': '#C44536',
        'success': '#7A8B6F',
        'card-bg': '#FFFFFF',
        'border-light': '#E5E0D8'
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
