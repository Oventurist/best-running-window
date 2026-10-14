// Shared run-length rule: total minutes must sit in 1-600. Raw field values
// use parseInt(...) || 0 semantics so empty/non-numeric counts as 0, matching
// the submit handler.
export function parseRunLengthMinutes(hValue, mValue) {
  const h = parseInt(hValue, 10) || 0;
  const m = parseInt(mValue, 10) || 0;
  return h * 60 + m;
}

export function isValidRunLength(hValue, mValue) {
  const total = parseRunLengthMinutes(hValue, mValue);
  return total >= 1 && total <= 600;
}
