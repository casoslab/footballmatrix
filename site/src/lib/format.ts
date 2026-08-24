import { localeTag, type Lang } from "./i18n";

/** Locale-grouped integer: 8.890 (tr) / 8,890 (en). */
export function fmtNumber(lang: Lang, value: number): string {
  return value.toLocaleString(localeTag(lang));
}

/** Years are labels, not quantities: never group them. */
export function fmtYear(year: number): string {
  return String(year);
}

/** "2026-08-03" → "3 Ağustos 2026" / "3 August 2026". */
export function fmtDate(lang: Lang, isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(localeTag(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
