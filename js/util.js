// Shared helpers (audit 2.3: cToF previously lived in comfort.js, ui.js, and
// inline in timeline.js — one definition now, imported everywhere).
export const cToF = (c) => (c * 9) / 5 + 32;
