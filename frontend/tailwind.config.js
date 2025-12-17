/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', "ui-sans-serif", "system-ui", "sans-serif"],
        luxury: ['"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
