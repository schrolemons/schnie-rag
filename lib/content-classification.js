/** Preserve caller-authored metadata; no built-in author or domain overrides. */
export function normalizeContentMetadata(metadata = {}) {
  return { ...metadata };
}
