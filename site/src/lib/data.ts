import { readFileSync } from "node:fs";
import type { Country, Player, SquadEntry, Tournament, TournamentType } from "./types";

/**
 * Reads the canonical dataset from data/dist/ at build time. The data is
 * read-only input: nothing here generates, modifies or re-derives it.
 * Modules are evaluated once per build process, so each file is parsed once
 * and shared by every page.
 */
function loadJson<T>(name: string): T {
  const url = new URL(`../../../data/dist/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

export const countries: Country[] = loadJson("countries.json");
export const tournaments: Tournament[] = loadJson("tournaments.json");
export const players: Player[] = loadJson("players.json");
export const squadEntries: SquadEntry[] = loadJson("squad-entries.json");

export const countryById = new Map(countries.map((c) => [c.id, c]));
export const tournamentById = new Map(tournaments.map((t) => [t.id, t]));
export const playerById = new Map(players.map((p) => [p.id, p]));
export const playerByWikipediaTitle = new Map(players.map((p) => [p.wikipediaTitle, p]));

export const entriesByCountry = groupBy(squadEntries, (e) => e.countryId);
export const entriesByPlayer = groupBy(squadEntries, (e) => e.playerId);
export const entriesByTournament = groupBy(squadEntries, (e) => e.tournamentId);

function groupBy<K, V>(items: V[], key: (item: V) => K): Map<K, V[]> {
  const map = new Map<K, V[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** The archive's own Turkish-aware normaliser (see data/raw/html inline scripts). */
export function normalizeTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function compareNamesTr(a: string, b: string): number {
  return a.localeCompare(b, "tr-TR", { sensitivity: "base" });
}

const yearsWithEntries = [
  ...new Set(squadEntries.map((e) => tournamentById.get(e.tournamentId)!.year)),
].sort((a, b) => a - b);

/** Site-wide totals, every one of them computed from data/dist. */
export const stats = {
  countryCount: countries.length,
  tournamentCount: tournaments.length,
  /** Sum of per-country distinct players (the "8,890 squad records" figure). */
  playerRows: [...entriesByCountry.values()].reduce(
    (sum, entries) => sum + new Set(entries.map((e) => e.playerId)).size,
    0,
  ),
  distinctPlayers: players.length,
  squadEntryCount: squadEntries.length,
  yearMin: yearsWithEntries[0]!,
  yearMax: yearsWithEntries[yearsWithEntries.length - 1]!,
};

export function yearSpan(min: number, max: number): string {
  return `${min}–${max}`;
}

export const siteSpan = yearSpan(stats.yearMin, stats.yearMax);

/** Most recent retrieval date in the dataset (all rows share it today). */
export const retrievedAt = tournaments.map((t) => t.retrievedAt).sort().at(-1)!;

/* ------------------------------------------------------------------ */
/* Country page model                                                  */
/* ------------------------------------------------------------------ */

export const ABSENT = "absent" as const;
export type MatrixCell = number | null | typeof ABSENT;

export interface MatrixRow {
  player: Player;
  tournamentCount: number;
  normalizedName: string;
  cells: MatrixCell[];
}

export interface CountryModel {
  country: Country;
  /** Newest first. */
  tournaments: Tournament[];
  /** Distinct tournament family names in order of most recent appearance. */
  familiesTr: string[];
  familiesEn: string[];
  /** Rows sorted by tournament count desc, then Turkish-aware name asc. */
  rows: MatrixRow[];
  yearMin: number;
  yearMax: number;
  distinctPlayers: number;
  recordCount: number;
  mostCapped: { player: Player; count: number };
  longestGap: { years: number; from: number; to: number } | null;
  /** Top repeat attendees (more than one tournament), max 6. */
  highlights: MatrixRow[];
  squadSizes: { tournament: Tournament; size: number }[];
}

export interface HomePlayerRank {
  player: Player;
  total: number;
  countries: Country[];
  byType: Record<TournamentType, number>;
}

export interface HomeCountrySummary {
  country: Country;
  tournamentCount: number;
  yearMin: number;
  yearMax: number;
  mostCapped: CountryModel["mostCapped"];
}

export interface HomeModel {
  topPlayers: HomePlayerRank[];
  countries: HomeCountrySummary[];
}

const countryModelCache = new Map<string, CountryModel>();

export function getCountryModel(countryId: string): CountryModel {
  const cached = countryModelCache.get(countryId);
  if (cached) return cached;

  const country = countryById.get(countryId)!;
  const entries = entriesByCountry.get(countryId) ?? [];

  const tournamentIds = [...new Set(entries.map((e) => e.tournamentId))];
  const countryTournaments = tournamentIds
    .map((id) => tournamentById.get(id)!)
    .sort((a, b) => b.year - a.year || compareNamesTr(a.id, b.id));

  const shirtByPlayer = new Map<string, Map<string, number | null>>();
  for (const e of entries) {
    let cell = shirtByPlayer.get(e.playerId);
    if (!cell) shirtByPlayer.set(e.playerId, (cell = new Map()));
    cell.set(e.tournamentId, e.shirtNumber);
  }

  const rows: MatrixRow[] = [...shirtByPlayer.entries()].map(([playerId, cell]) => ({
    player: playerById.get(playerId)!,
    tournamentCount: cell.size,
    normalizedName: normalizeTr(playerById.get(playerId)!.name),
    cells: countryTournaments.map((t) => (cell.has(t.id) ? cell.get(t.id)! : ABSENT)),
  }));
  rows.sort((a, b) => b.tournamentCount - a.tournamentCount || compareNamesTr(a.player.name, b.player.name));

  const years = countryTournaments.map((t) => t.year).sort((a, b) => a - b);
  let longestGap: CountryModel["longestGap"] = null;
  for (let i = 1; i < years.length; i++) {
    const diff = years[i]! - years[i - 1]!;
    if (!longestGap || diff > longestGap.years) {
      longestGap = { years: diff, from: years[i - 1]!, to: years[i]! };
    }
  }

  const familiesTr: string[] = [];
  const familiesEn: string[] = [];
  for (const t of countryTournaments) {
    if (!familiesTr.includes(t.nameTr)) familiesTr.push(t.nameTr);
    if (!familiesEn.includes(t.nameEn)) familiesEn.push(t.nameEn);
  }

  const model: CountryModel = {
    country,
    tournaments: countryTournaments,
    familiesTr,
    familiesEn,
    rows,
    yearMin: years[0]!,
    yearMax: years[years.length - 1]!,
    distinctPlayers: rows.length,
    recordCount: entries.length,
    mostCapped: { player: rows[0]!.player, count: rows[0]!.tournamentCount },
    longestGap,
    highlights: rows.filter((r) => r.tournamentCount > 1).slice(0, 6),
    squadSizes: countryTournaments.map((t) => ({
      tournament: t,
      size: entries.filter((e) => e.tournamentId === t.id).length,
    })),
  };
  countryModelCache.set(countryId, model);
  return model;
}

/* ------------------------------------------------------------------ */
/* Home page model                                                     */
/* ------------------------------------------------------------------ */

let homeModelCache: HomeModel | undefined;

/** Homepage rankings, computed only from the canonical squad entries. */
export function getHomeModel(): HomeModel {
  if (homeModelCache) return homeModelCache;

  const topPlayers = [...entriesByPlayer.entries()]
    .map(([playerId, entries]) => {
      const byType: Record<TournamentType, number> = {
        "world-cup": 0,
        continental: 0,
        olympic: 0,
      };
      for (const entry of entries) {
        byType[tournamentById.get(entry.tournamentId)!.type] += 1;
      }
      const countryIds = [...new Set(entries.map((entry) => entry.countryId))];
      return {
        player: playerById.get(playerId)!,
        total: entries.length,
        countries: countryIds.map((countryId) => countryById.get(countryId)!),
        byType,
      };
    })
    .sort((a, b) => b.total - a.total || compareNamesTr(a.player.name, b.player.name))
    .slice(0, 6);

  const homeCountries = countries
    .map((country) => {
      const model = getCountryModel(country.id);
      return {
        country,
        tournamentCount: model.tournaments.length,
        yearMin: model.yearMin,
        yearMax: model.yearMax,
        mostCapped: model.mostCapped,
      };
    })
    .sort(
      (a, b) =>
        b.tournamentCount - a.tournamentCount || compareNamesTr(a.country.nameTr, b.country.nameTr),
    );

  homeModelCache = { topPlayers, countries: homeCountries };
  return homeModelCache;
}

/* ------------------------------------------------------------------ */
/* Player page model                                                   */
/* ------------------------------------------------------------------ */

export interface PlayerHistoryRow {
  tournament: Tournament;
  country: Country;
  shirtNumber: number | null;
}

export interface PlayerModel {
  player: Player;
  /** Chronological order (oldest first). */
  history: PlayerHistoryRow[];
  countries: Country[];
}

const playerModelCache = new Map<string, PlayerModel>();

export function getPlayerModel(playerId: string): PlayerModel {
  const cached = playerModelCache.get(playerId);
  if (cached) return cached;
  const player = playerById.get(playerId)!;
  const entries = entriesByPlayer.get(playerId) ?? [];
  const history = entries
    .map((e) => ({
      tournament: tournamentById.get(e.tournamentId)!,
      country: countryById.get(e.countryId)!,
      shirtNumber: e.shirtNumber,
    }))
    .sort((a, b) => a.tournament.year - b.tournament.year || compareNamesTr(a.tournament.id, b.tournament.id));
  const countries = [...new Set(history.map((h) => h.country.id))].map((id) => countryById.get(id)!);
  const model = { player, history, countries };
  playerModelCache.set(playerId, model);
  return model;
}

/* ------------------------------------------------------------------ */
/* Tournament page model                                               */
/* ------------------------------------------------------------------ */

export interface TournamentSquad {
  country: Country;
  entries: { player: Player; shirtNumber: number | null }[];
}

export interface TournamentModel {
  tournament: Tournament;
  squads: TournamentSquad[];
}

const tournamentModelCache = new Map<string, TournamentModel>();

export function getTournamentModel(tournamentId: string): TournamentModel {
  const cached = tournamentModelCache.get(tournamentId);
  if (cached) return cached;
  const tournament = tournamentById.get(tournamentId)!;
  const entries = entriesByTournament.get(tournamentId) ?? [];
  const byCountry = groupBy(entries, (e) => e.countryId);
  const squads = [...byCountry.entries()]
    .map(([countryId, list]) => ({
      country: countryById.get(countryId)!,
      entries: list
        .map((e) => ({ player: playerById.get(e.playerId)!, shirtNumber: e.shirtNumber }))
        .sort(
          (a, b) =>
            (a.shirtNumber ?? Number.MAX_SAFE_INTEGER) - (b.shirtNumber ?? Number.MAX_SAFE_INTEGER) ||
            compareNamesTr(a.player.name, b.player.name),
        ),
    }))
    .sort((a, b) => compareNamesTr(a.country.nameTr, b.country.nameTr));
  const model = { tournament, squads };
  tournamentModelCache.set(tournamentId, model);
  return model;
}

/* ------------------------------------------------------------------ */
/* Year labels: the 1959 Copa América was played twice in one year.   */
/* ------------------------------------------------------------------ */

const ROMAN = ["", "I", "II", "III", "IV"] as const;

export function yearLabel(tournament: Tournament): string {
  /* Only the *same* competition played twice in one year carries an edition
     suffix (`copa-america-1959-2`). Several different competitions sharing a
     year — 1963 had the AFCON, the CONCACAF Championship and the Copa América
     — need no numeral: their names already tell them apart. */
  const edition = /-\d{4}-(\d+)$/.exec(tournament.id)?.[1];
  if (!edition) return String(tournament.year);
  return `${tournament.year} ${ROMAN[Number(edition)] ?? edition}`;
}
