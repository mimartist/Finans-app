/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: {
          DEFAULT: '#0a0c10',
          2: '#111318',
          3: '#181c24',
          4: '#1e2330',
        },
        accent: {
          blue: '#6c8fff',
          green: '#4ade9a',
          amber: '#f59e0b',
          red: '#f87171',
          purple: '#a78bfa',
        },
      },
    },
  },
  plugins: [],
}
