/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*/index.html',
    './js/**/*.js',
    '../../packages/frontend-core/src/**/*.{html,js,svelte,ts}',
  ],
  darkMode: 'class',
  // The site has its own .container (css/base.css). Tailwind's component of
  // the same name loads later and would override every narrow/wide variant.
  corePlugins: {
    container: false,
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
