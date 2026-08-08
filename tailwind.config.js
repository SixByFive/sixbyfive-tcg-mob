/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class", // ✅ match web setup
  theme: {
    extend: {
      colors: {
        // --- Light Theme ---
        'light-background': '#f5f6fa',
        'light-surface':    '#f7f7fb',
        'light-alt':        '#eef1f7',
        'light-text':       '#232346',
        'light-textSecondary': '#464d6b',
        'light-textMuted':  '#5f6570',
        'light-border':     '#e2e8f0',
        'light-accent':     '#2963FF',   // ✅ brand blue
        'light-accentLight':'#548dff',

        // --- Dark Theme ---
        'dark-background':  '#0b0d14',
        'dark-surface':     '#111520',
        'dark-alt':         '#181c28',
        'dark-surf3':       '#1e2234',
        'dark-text':        '#edf0fa',
        'dark-textSecondary':'#9aa3c4',
        'dark-textMuted':   '#5c6480',
        'dark-border':      'rgba(255,255,255,0.07)',
        'dark-borderMid':   'rgba(255,255,255,0.13)',
        'dark-accent':      '#4169f4',
        'dark-accentDim':   'rgba(65,105,244,0.14)',
        'dark-accentLight': '#6b8ff7',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Raleway', 'sans-serif'],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
