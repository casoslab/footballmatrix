import en from "../i18n/en.json";
import tr from "../i18n/tr.json";
import type { Country, Tournament } from "./types";

export type Lang = "tr" | "en";
export const LOCALES: Lang[] = ["tr", "en"];

const STRINGS: Record<Lang, Record<string, unknown>> = { tr, en };

export function otherLang(lang: Lang): Lang {
  return lang === "tr" ? "en" : "tr";
}

/** BCP 47 tag used for number/date formatting and client-side collation. */
export function localeTag(lang: Lang): string {
  return lang === "tr" ? "tr-TR" : "en-GB";
}

/** Dot-path lookup with {var} interpolation. Missing keys fail the build. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  let node: unknown = STRINGS[lang];
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown>)?.[part];
  }
  if (typeof node !== "string") throw new Error(`missing i18n key: ${lang}:${key}`);
  return node.replace(/\{(\w+)\}/g, (raw, name: string) =>
    name in vars ? String(vars[name]) : raw,
  );
}

/**
 * Every link goes through here. A GitHub Pages project site is served from
 * `/<repo>/`, not from the root, so a bare `/tr/...` would 404 in production
 * while working perfectly in local dev — the worst kind of bug to find late.
 * `import.meta.env.BASE_URL` is `/` locally and `/footballmatrix/` when the
 * build sets a base.
 */
function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith("/") ? base.slice(0, -1) : base}${path}`;
}

export function hrefHome(lang: Lang): string {
  return withBase(`/${lang}/`);
}
export function hrefCountry(lang: Lang, id: string): string {
  return withBase(lang === "tr" ? `/tr/ulke/${id}/` : `/en/country/${id}/`);
}
export function hrefPlayer(lang: Lang, id: string): string {
  return withBase(lang === "tr" ? `/tr/oyuncu/${id}/` : `/en/player/${id}/`);
}
export function hrefTournament(lang: Lang, id: string): string {
  return withBase(lang === "tr" ? `/tr/turnuva/${id}/` : `/en/tournament/${id}/`);
}
export function hrefQuality(lang: Lang): string {
  return withBase(lang === "tr" ? "/tr/veri-kalitesi/" : "/en/data-quality/");
}
export function hrefAbout(lang: Lang): string {
  return withBase(lang === "tr" ? "/tr/hakkinda/" : "/en/about/");
}

export function countryName(country: Country, lang: Lang): string {
  return lang === "tr" ? country.nameTr : country.nameEn;
}

export function tournamentName(tournament: Tournament, lang: Lang): string {
  return lang === "tr" ? tournament.nameTr : tournament.nameEn;
}
