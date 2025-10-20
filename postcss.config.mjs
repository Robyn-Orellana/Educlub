// Force Tailwind to use the JS/Node fallback instead of the native Oxide binary.
// This avoids rare "unexpected end of file" crashes when the oxide child process
// fails to spawn in certain CI/build environments (e.g. Turbopack on Vercel).
if (!process.env.TAILWIND_DISABLE_OXIDE) {
  process.env.TAILWIND_DISABLE_OXIDE = '1';
}

import tailwind from "@tailwindcss/postcss";

export default {
  plugins: [tailwind],
};
