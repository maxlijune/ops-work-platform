/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // GitHub-inspired palette (warm overlay)
        'primary': '#0969DA',
        'primary-dark': '#0550AE',
        'primary-light': '#218BFF',
        'bg-main': '#F6F8FA',
        'bg-sidebar': '#0D1117',
        'bg-sidebar-hover': '#1C2128',
        'bg-sidebar-active': '#1F6FEB',
        'text-main': '#1F2328',
        'text-secondary': '#656D76',
        'warning': '#BF8700',
        'danger': '#CF222E',
        'success': '#1A7F37',
        'card-bg': '#FFFFFF',
        'border-light': '#D0D7DE',
        'border-dark': '#30363D',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'mono': ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
