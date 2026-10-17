import 'server-only';

// Draft checklist utility only. NOT wired into Create Order.
// Support points 6/7 require seven entries, at least three available values and
// NA for unavailable entries. Create Order documents additional_info1 through 7.
// Business field mapping, length limit and whether point 12's dash means ASCII
// '-' or Unicode '–' still require resolution; never assign customer PII here.
// The existing ASCII policy and 100-character local cap are provisional.
export interface BilldeskAdditionalInfo {
  [key: string]: string;
  additional_info1: string;
  additional_info2: string;
  additional_info3: string;
  additional_info4: string;
  additional_info5: string;
  additional_info6: string;
  additional_info7: string;
}

/**
 * Sanitizes a string value according to the provisional local character policy:
 * Allowed characters: alphanumeric (a-z, A-Z, 0-9), '@', comma (','), period ('.'), and hyphen ('-').
 * Any disallowed characters (such as spaces, colons, underscores, quotes, etc.) are replaced with '-'.
 * Consecutive hyphens are collapsed into a single hyphen, and leading/trailing punctuation is trimmed.
 * Returns 'NA' for empty, undefined, null, or values containing no allowed characters.
 */
export function sanitizeAdditionalInfoValue(val: unknown, maxLen = 100): string {
  if (typeof val !== 'string') return 'NA';
  const trimmed = val.trim();
  if (!trimmed) return 'NA';

  // Replace disallowed characters with '-'
  const sanitized = trimmed.replace(/[^a-zA-Z0-9@,.-]/g, '-');
  // Collapse duplicate hyphens
  const collapsed = sanitized.replace(/-+/g, '-').slice(0, maxLen);
  // Trim leading/trailing hyphens, periods, or commas
  const cleaned = collapsed.replace(/^[-.,]+|[-.,]+$/g, '');

  if (!cleaned) {
    return 'NA';
  }
  return cleaned;
}

export function isValidAdditionalInfoValue(val: string): boolean {
  if (typeof val !== 'string' || val.length === 0 || val.length > 100) return false;
  return /^[a-zA-Z0-9@,.-]+$/.test(val);
}

/**
 * Normalizes seven caller-supplied slots without assigning customer data to them.
 * Keys follow the published Create Order additional_info object schema.
 * Missing values become NA. Building does NOT guarantee three populated values;
 * validateAdditionalInfo must also pass, and merchant approval is still required.
 */
export function buildAdditionalInfo(values: readonly unknown[]): BilldeskAdditionalInfo {
  if (values.length !== 7) throw new Error('Additional Info requires exactly seven slots');
  const info: BilldeskAdditionalInfo = {
    additional_info1: sanitizeAdditionalInfoValue(values[0]),
    additional_info2: sanitizeAdditionalInfoValue(values[1]),
    additional_info3: sanitizeAdditionalInfoValue(values[2]),
    additional_info4: sanitizeAdditionalInfoValue(values[3]),
    additional_info5: sanitizeAdditionalInfoValue(values[4]),
    additional_info6: sanitizeAdditionalInfoValue(values[5]),
    additional_info7: sanitizeAdditionalInfoValue(values[6]),
  };

  return info;
}

/**
 * Checks the supplied checklist counts and provisional local character policy:
 * - Contains exactly fields 1 through 7
 * - Every value is non-empty and contains ONLY allowed characters
 * - At least 3 values are non-NA
 */
export function validateAdditionalInfo(info: Record<string, unknown> | BilldeskAdditionalInfo): boolean {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return false;
  const keys = ['additional_info1', 'additional_info2', 'additional_info3', 'additional_info4', 'additional_info5', 'additional_info6', 'additional_info7'];
  if (Object.keys(info).length !== keys.length || keys.some(key => !Object.hasOwn(info, key))) return false;
  let nonNaCount = 0;
  for (const key of keys) {
    const val = (info as Record<string, unknown>)[key];
    if (typeof val !== 'string' || !isValidAdditionalInfoValue(val)) {
      return false;
    }
    if (val !== 'NA') {
      nonNaCount++;
    }
  }
  return nonNaCount >= 3;
}
