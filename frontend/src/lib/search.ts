/**
 * Query helpers shared by the results view.
 */

/** Trim a "base + attribute" query down to something short enough for a chip. */
export function shortenRefinement(baseQuery: string, suggestion: string, limit = 64): string {
  if (suggestion.length <= limit) return suggestion
  const lastWord = suggestion.split(' ').pop() ?? ''
  return `${baseQuery.trim()} ${lastWord}`.trim()
}

/**
 * Build "base query + attribute" refinements from the recognised product
 * attributes, so a search can be narrowed with one tap.
 */
export function buildRefinements(
  baseQuery: string,
  attributes: string[],
  limit = 64,
): string[] {
  const base = baseQuery.trim()
  return attributes
    .slice(0, 4)
    .map((attribute) => `${base} ${attribute}`.replace(/\s+/g, ' ').trim())
    .filter((suggestion) => suggestion.toLowerCase() !== base.toLowerCase())
    .map((suggestion) => shortenRefinement(base, suggestion, limit))
    .filter((suggestion, index, all) => all.indexOf(suggestion) === index)
    .slice(0, 3)
}
