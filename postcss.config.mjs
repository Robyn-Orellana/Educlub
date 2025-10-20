// Force Tailwind to use the JS/Node fallback instead of the native Oxide binary.
// This avoids rare "unexpected end of file" crashes when the oxide child process
// fails to spawn in certain CI/build environments (e.g. Turbopack on Vercel).
if (!process.env.TAILWIND_DISABLE_OXIDE) {
  process.env.TAILWIND_DISABLE_OXIDE = '1';
}

// Next.js requires PostCSS plugins to be specified as strings, not imported functions.
// See: https://nextjs.org/docs/messages/postcss-shape
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
