/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*/index.html',
    './js/**/*.js',
    './islands/**/*.{js,svelte}',
    '../packages/frontend-core/src/**/*.{html,js,svelte,ts}',
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
