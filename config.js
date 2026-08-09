// ══ AlphaDetail Client Environment Configuration ══
// Loaded before script.js — provides runtime env variables to the browser.
// ⚠️  Never put secret keys (RAZORPAY_KEY_SECRET, JWT_SECRET, etc.) here.
//     Only public/client-safe values belong in this file.
//
// To switch environments, toggle the API_BASE lines below.
// In a CI/CD pipeline this file is generated from the server-side .env.

window.ENV = {
  // ── API ──────────────────────────────────────────────────────────────
  // Local dev
  // API_BASE: "http://localhost:5000/api",
  // API_BASE_URL: "https://alphadetailserver.vercel.app/api",

  // ── Razorpay (public key only — secret stays in server .env) ─────────
  // RAZORPAY_KEY_ID is returned by the server on /payments/create-id,
  // so it is NOT required here. Keeping it as a reference/override only.
  // RAZORPAY_KEY_ID: "rzp_live_TMWYGoSA3joFf2",

  // ── App Metadata ──────────────────────────────────────────────────────
  APP_NAME: "AlphaDetail",
  APP_VERSION: "2.0.1",
};
