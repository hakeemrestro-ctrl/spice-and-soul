const PAREN_RE = /^(.+?)\s*\(([^)]+)\)\s*$/;

/**
 * Splits a recipe title like "Butter Chicken (Murgh Makhani)" into
 * primary English title + romanised native name. Falls back gracefully
 * for titles without parentheses.
 */
export function splitRecipeTitle(title: string): {
  primary: string;
  secondary: string | null;
} {
  const match = title.match(PAREN_RE);
  if (!match) return { primary: title, secondary: null };
  return { primary: match[1].trim(), secondary: match[2].trim() };
}
