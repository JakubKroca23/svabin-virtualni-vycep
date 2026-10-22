/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,html}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        svabin: {
          bg: '#13110e',
          surface: '#1b1814',
          elevated: '#231f1a',
          border: '#2e2923',
          borderlight: '#3d362e',
          cream: '#f3ede2',
          sand: '#d8cfc0',
          muted: '#9a9083',
          amber: '#c88a36',
          amberhover: '#b57928',
          green: '#2d4a34',
          greentext: '#8ec099',
        },
      },
    },
  },
  plugins: [],
};
