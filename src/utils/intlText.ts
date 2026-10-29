/**
 * Locale-aware joining and pluralisation for the row renderers.
 *
 * ── Why this is not a one/many table ────────────────────────────────────────
 *
 * The two aggregate surfaces in this package -- the mixed-group summary
 * ("3 reactions and 2 comments") and the actor list ("Alex, Sam and 3 others")
 * -- both built their English by hand: a `{ one, many }` noun table, a literal
 * `", "`, and a literal `" and "`.
 *
 * That is wrong for most of the languages this package is rendered in. Polish
 * has three plural categories and Arabic six, so "one or not one" cannot pick
 * the right noun; and the list separator is not `", "` everywhere, nor is the
 * final conjunction always a word placed between the last two items.
 *
 * `Intl.PluralRules` and `Intl.ListFormat` know all of this per locale, and
 * both have been in every browser this app supports for years. So the package
 * asks the platform which plural CATEGORY a count falls in, and the host
 * supplies a noun per category; and it asks the platform how to join a list,
 * rather than deciding that itself.
 */

export interface TextOptions {
  /** BCP-47 tag. Omitted, Intl uses the runtime default. */
  locale?: string;
  /** Host copy, keyed as described on NotificationLabels. */
  labels?: Record<string, string>;
}

/** Plural category for a count in a locale: "one", "other", "few", … */
export function pluralCategory(count: number, locale?: string): string {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    // An invalid locale tag should degrade to English rules, not throw inside
    // a render. Same reasoning as every other fallback in this package.
    return count === 1 ? "one" : "other";
  }
}

/** A count written the way the locale writes numbers. */
export function formatCount(count: number, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale).format(count);
  } catch {
    return String(count);
  }
}

/** "a, b and c" in the locale's own punctuation and conjunction. */
export function joinList(parts: string[], locale?: string): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(parts);
  } catch {
    return parts.length === 2
      ? `${parts[0]} and ${parts[1]}`
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }
}

/**
 * The literal separators a locale puts BETWEEN list items.
 *
 * The actor list is nodes, not strings -- each name carries its own verified
 * badge -- so it cannot be handed to `format()`. `formatToParts` over
 * placeholder strings gives back the locale's own "literal" pieces in order,
 * which the caller interleaves with its nodes. The result is a list punctuated
 * by the locale even though the package never sees the names as one string.
 *
 * Returns `length - 1` separators, or English ones if Intl is unavailable.
 */
export function listSeparators(length: number, locale?: string): string[] {
  if (length < 2) return [];
  const placeholders = Array.from({ length }, (_, i) => `\u0000${i}`);
  try {
    const parts = new Intl.ListFormat(locale, { style: "long", type: "conjunction" })
      .formatToParts(placeholders);
    const separators: string[] = [];
    let pending = "";
    for (const part of parts) {
      if (part.type === "literal") pending += part.value;
      else if (separators.length < length - 1 && pending !== "") {
        separators.push(pending);
        pending = "";
      }
    }
    // One trailing literal may still be buffered when the locale ends the list
    // with punctuation rather than placing it between items.
    if (pending !== "" && separators.length < length - 1) separators.push(pending);
    if (separators.length === length - 1) return separators;
  } catch {
    // fall through
  }
  return Array.from({ length: length - 1 }, (_, i) =>
    i === length - 2 ? " and " : ", ",
  );
}
