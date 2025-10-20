// Force Tailwind to use the JS/Node fallback instead of the native Oxide binary.
// This avoids rare "unexpected end of file" crashes when the oxide child process
// fails to spawn in certain CI/build environments (e.g. Turbopack on Vercel).
if (!process.env.TAILWIND_DISABLE_OXIDE) {
  process.env.TAILWIND_DISABLE_OXIDE = '1';
}

// Force Lightning CSS to use WASM instead of native binary to avoid platform
// prebuild issues on some CI environments (e.g., linux-x64-gnu vs musl).
if (!process.env.LIGHTNINGCSS_USE_WASM) {
  process.env.LIGHTNINGCSS_USE_WASM = '1';
}
if (!process.env.LIGHTNINGCSS_IGNORE_NODE) {
  process.env.LIGHTNINGCSS_IGNORE_NODE = '1';
}

// Next.js requires PostCSS plugins to be specified as strings, not imported functions.
// See: https://nextjs.org/docs/messages/postcss-shape
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
