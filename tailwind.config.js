/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",      // if you use the old "pages" folder
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}", // for all reusable components
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",        // for the new App Router (your case)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};