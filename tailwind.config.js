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
        'dark-background':  '#16171c',
        'dark-surface':     '#191a20',
        'dark-alt':         '#23243c',
        'dark-text':        '#f7f8fa',
        'dark-textSecondary':'#b9bedd',
        'dark-textMuted':   '#8f98bc',
        'dark-border':      '#31365e',
        'dark-accent':      '#2963FF',  
        'dark-accentLight': '#548dff',
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
