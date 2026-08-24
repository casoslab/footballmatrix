import { readFileSync } from "node:fs";
import { countries, playerByWikipediaTitle, players } from "./data";
import type { Country, Player, Position, PositionMismatch } from "./types";

/** Derivations for the data quality page. All counts trace to data/dist. */

function loadJson<T>(name: string): T {
  const url = new URL(`../../../data/dist/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

interface SlugCollision {
  baseSlug: string;
  players: { wikipediaTitle: string; playerId: string }[];
}

interface ExtractionReport {
  anomalies: {
    sourceMissingBirthYears: {
      rowCount: number;
      decision: string;
      rows: { countryId: string; rowNumber: number; wikipediaTitle: string }[];
    };
    searchLinks: { rowCount: number };
    standByRows: { rowCount: number };
    sharedPlayers: { playerId: string; countryIds: string[] }[];
    metadataConflicts: { playerId: string }[];
    slugCollisions: SlugCollision[];
    editionDisambiguations: { decision: string };
  };
}

const report = loadJson<ExtractionReport>("extraction-report.json");
const mismatches = loadJson<PositionMismatch[]>("reports/position-mismatches.json");

const countryNameById = new Map(countries.map((c) => [c.id, c]));

export const tiers = {
  confirmed: players.filter((p) => p.positionConfidence === "confirmed").length,
  disputed: players.filter((p) => p.positionConfidence === "disputed").length,
  unverified: players.filter((p) => p.positionConfidence === "unverified").length,
};

/** Turn wikitext link markup into legible plain text, keeping every reading. */
export function stripWikilinks(field: string): string {
  return field
    .replace(/\[\[[^\]|]*\|([^\]|]*)\]\]/g, "$1")
    .replace(/\[\[([^\]|]*)\]\]/g, "$1")
    .replace(/\{\{hlist\|/g, "")
    .replace(/\}\}/g, "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export interface DisputeRow {
  player: Player | null;
  fallbackName: string;
  archivePosition: Position;
  wikipediaField: string;
  suggested: Position;
  wikipediaUrl: string;
}

export const disputes: DisputeRow[] = mismatches.map((m) => ({
  player: playerByWikipediaTitle.get(m.title) ?? null,
  fallbackName: m.name,
  archivePosition: m.position,
  wikipediaField: stripWikilinks(m.position_field),
  suggested: m.suggested,
  wikipediaUrl: m.wikipedia,
}));

export interface MissingBirthRow {
  player: Player | null;
  fallbackTitle: string;
  country: Country;
}

export const missingBirthYears: MissingBirthRow[] = report.anomalies.sourceMissingBirthYears.rows
  .map((row) => ({
    player: playerByWikipediaTitle.get(row.wikipediaTitle) ?? null,
    fallbackTitle: row.wikipediaTitle,
    country: countryNameById.get(row.countryId)!,
  }))
  .sort((a, b) => {
    const nameA = a.player?.name ?? a.fallbackTitle;
    const nameB = b.player?.name ?? b.fallbackTitle;
    return (
      nameA.localeCompare(nameB, "tr-TR", { sensitivity: "base" }) ||
      a.country.id.localeCompare(b.country.id)
    );
  });

export const missingBirthYearCount = report.anomalies.sourceMissingBirthYears.rowCount;

export const slugCollisions = report.anomalies.slugCollisions;

export const otherAnomalies = {
  searchLinks: report.anomalies.searchLinks.rowCount,
  standByRows: report.anomalies.standByRows.rowCount,
  sharedPlayers: report.anomalies.sharedPlayers.length,
  metadataConflicts: report.anomalies.metadataConflicts.length,
};

/** For the player page: the disputed player's Wikipedia position field. */
export function disputeFieldFor(wikipediaTitle: string): PositionMismatch | null {
  return mismatches.find((m) => m.title === wikipediaTitle) ?? null;
}
