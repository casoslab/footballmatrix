export interface CountryTheme {
  sky: string;
  skySoft: string;
  navy: string;
  gold: string;
}

export interface Country {
  id: string;
  nameTr: string;
  nameEn: string;
  iso3: string;
  flagEmoji: string;
  confederation: string;
  theme: CountryTheme;
}

export type TournamentType = "world-cup" | "continental" | "olympic";

export interface Tournament {
  id: string;
  type: TournamentType;
  year: number;
  nameTr: string;
  nameEn: string;
  sourceUrl: string;
  retrievedAt: string;
}

export type Position = "GK" | "DF" | "MF" | "FW";
export type PositionConfidence = "confirmed" | "disputed" | "unverified";

export interface Player {
  id: string;
  name: string;
  wikipediaTitle: string;
  wikipediaUrl: string;
  birthYear: number | null;
  position: Position | null;
  positionConfidence: PositionConfidence;
}

export interface SquadEntry {
  countryId: string;
  tournamentId: string;
  playerId: string;
  shirtNumber: number | null;
}

export interface PositionMismatch {
  page: string;
  name: string;
  position: Position;
  title: string;
  source_title: string;
  wikipedia: string;
  position_field: string;
  categories: Position[];
  suggested: Position;
}
