/**
 * Address notes and drafts use the platform GEMINI_API_KEY on the ML service.
 * Sellers do not supply a key. A missing key, or a Gemini error, falls back to
 * the built-in templates. Saved seller envelopes are ignored.
 */
export function geminiCallFor(): undefined {
  return undefined;
}
