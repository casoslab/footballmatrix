#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rawHtml = path.join(root, 'data', 'raw', 'html');
const dist = path.join(root, 'data', 'dist');
const pageSuffix = '-dunya-kupasi-kadrolari.html';
const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const camelCase = /^[a-z][A-Za-z0-9]*$/;


function fail(message) {
  throw new Error(message);
}


function check(condition, message) {
  if (!condition) fail(message);
}


function readJson(relativePath) {
  const fullPath = path.join(dist, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(`${relativePath}: cannot read valid JSON (${error.message})`);
  }
}


function checkCamelCase(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkCamelCase(item, `${label}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    check(camelCase.test(key), `${label}: JSON field ${JSON.stringify(key)} is not camelCase`);
    checkCamelCase(nested, `${label}.${key}`);
  }
}


function checkExactFields(value, expected, label) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}: expected an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  check(isDeepStrictEqual(actual, wanted), `${label}: expected fields ${wanted.join(', ')}, found ${actual.join(', ')}`);
}


function uniqueById(items, label) {
  check(Array.isArray(items), `${label}: expected a JSON array`);
  const result = new Map();
  items.forEach((item, index) => {
    check(item && typeof item.id === 'string', `${label}[${index}]: missing string id`);
    check(kebabCase.test(item.id), `${label}[${index}]: id ${JSON.stringify(item.id)} is not kebab-case`);
    check(!result.has(item.id), `${label}: duplicate id ${item.id}`);
    result.set(item.id, item);
  });
  return result;
}


function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .trim();
}


function tournamentId(headerType, nameTr, yearLabel, pageName) {
  const yearMatch = yearLabel.match(/^(\d{4})(?:-(I|II))?$/);
  check(yearMatch, `${pageName}: invalid tournament year label ${yearLabel}`);
  const year = yearMatch[1];
  const edition = yearMatch[2] === 'I' ? '-1' : yearMatch[2] === 'II' ? '-2' : '';
  if (headerType === 'world-cup') return `world-cup-${year}${edition}`;
  if (headerType === 'olympic') return `olympics-${year}${edition}`;
  const prefixes = new Map([
    ['Avrupa Şampiyonası', 'euro'],
    ['Copa América', 'copa-america'],
    ['Afrika Uluslar Kupası', 'afcon'],
    ['CONCACAF Gold Cup', 'gold-cup'],
    ['CONCACAF Şampiyonası', 'concacaf-championship'],
  ]);
  check(headerType === 'continental', `${pageName}: unknown tournament type ${headerType}`);
  check(prefixes.has(nameTr), `${pageName}: unknown continental tournament ${nameTr}`);
  return `${prefixes.get(nameTr)}-${year}${edition}`;
}


function rawPageExpectation(filename) {
  const source = fs.readFileSync(path.join(rawHtml, filename), 'utf8');
  const countryId = filename.slice(0, -pageSuffix.length);
  const headerPattern = /<th scope="col" class="year (world-cup|continental|olympic)">.*?<span>(.*?)<\/span>(.*?)<i class="sort-indicator"/gs;
  const headers = [...source.matchAll(headerPattern)].map((match) => {
    const nameTr = decodeHtml(match[2]);
    const yearLabel = decodeHtml(match[3]);
    return {
      label: `${yearLabel} ${nameTr}`,
      tournamentId: tournamentId(match[1], nameTr, yearLabel, filename),
      type: match[1],
    };
  });
  const countsMatch = source.match(/const counts = (\[.*?\]);/s);
  check(countsMatch, `${filename}: counts array is missing`);
  let counts;
  try {
    counts = JSON.parse(countsMatch[1]);
  } catch (error) {
    fail(`${filename}: invalid counts JSON (${error.message})`);
  }
  check(headers.length === counts.length, `${filename}: ${headers.length} headers but ${counts.length} counts`);
  headers.forEach((header, index) => {
    check(header.label === counts[index][0], `${filename}: header ${index + 1} is ${header.label}, counts label is ${counts[index][0]}`);
    check(Number.isInteger(counts[index][1]) && counts[index][1] > 0, `${filename}: invalid count for ${header.label}`);
    header.expectedEntries = counts[index][1];
  });
  return {
    countryId,
    playerRows: [...source.matchAll(/<tr data-name=/g)].length,
    headers,
  };
}


function validate() {
  const countries = readJson('countries.json');
  const tournaments = readJson('tournaments.json');
  const players = readJson('players.json');
  const squadEntries = readJson('squad-entries.json');
  const extractionReport = readJson('extraction-report.json');
  const countryMap = uniqueById(countries, 'countries.json');
  const tournamentMap = uniqueById(tournaments, 'tournaments.json');
  const playerMap = uniqueById(players, 'players.json');

  countries.forEach((country, index) => {
    const label = `countries.json[${index}]`;
    checkExactFields(country, ['id', 'nameTr', 'nameEn', 'iso3', 'flagEmoji', 'confederation', 'theme'], label);
    checkExactFields(country.theme, ['sky', 'skySoft', 'navy', 'gold'], `${label}.theme`);
    check(/^[A-Z]{3}$/.test(country.iso3), `${label}: iso3 must have three uppercase ASCII letters`);
    check(['UEFA', 'CONMEBOL', 'CAF', 'CONCACAF'].includes(country.confederation), `${label}: invalid confederation ${country.confederation}`);
  });
  tournaments.forEach((tournament, index) => {
    const label = `tournaments.json[${index}]`;
    checkExactFields(tournament, ['id', 'type', 'year', 'nameTr', 'nameEn', 'sourceUrl', 'retrievedAt'], label);
    check(['world-cup', 'continental', 'olympic'].includes(tournament.type), `${label}: invalid type ${tournament.type}`);
    check(Number.isInteger(tournament.year), `${label}: year must be an integer`);
    check(/^https:\/\/en\.wikipedia\.org\/wiki\//.test(tournament.sourceUrl), `${label}: invalid sourceUrl`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(tournament.retrievedAt), `${label}: invalid retrievedAt`);
  });
  players.forEach((player, index) => {
    const label = `players.json[${index}]`;
    checkExactFields(player, ['id', 'name', 'wikipediaTitle', 'wikipediaUrl', 'birthYear', 'position', 'positionConfidence'], label);
    check(player.birthYear === null || Number.isInteger(player.birthYear), `${label}: birthYear must be an integer or null`);
    check(
      player.position === null || ['GK', 'DF', 'MF', 'FW'].includes(player.position),
      `${label}: invalid position ${player.position}`,
    );
    check(
      (player.position === null) === (player.positionConfidence === 'unverified'),
      `${label}: position null and positionConfidence 'unverified' must agree`,
    );
    check(['confirmed', 'disputed', 'unverified'].includes(player.positionConfidence), `${label}: invalid positionConfidence ${player.positionConfidence}`);
    check(/^https:\/\/en\.wikipedia\.org\/wiki\//.test(player.wikipediaUrl), `${label}: invalid wikipediaUrl`);
  });

  check(Array.isArray(squadEntries), 'squad-entries.json: expected a JSON array');
  const entryKeys = new Set();
  const tournamentsByCountry = new Map([...countryMap.keys()].map((id) => [id, new Set()]));
  const entryCountByTournament = new Map([...tournamentMap.keys()].map((id) => [id, 0]));
  const entriesByCountryTournament = new Map();
  squadEntries.forEach((entry, index) => {
    const label = `squad-entries.json[${index}]`;
    checkExactFields(entry, ['countryId', 'tournamentId', 'playerId', 'shirtNumber'], label);
    check(countryMap.has(entry.countryId), `${label}: unknown countryId ${entry.countryId}`);
    check(tournamentMap.has(entry.tournamentId), `${label}: unknown tournamentId ${entry.tournamentId}`);
    check(playerMap.has(entry.playerId), `${label}: unknown playerId ${entry.playerId}`);
    check(entry.shirtNumber === null || Number.isInteger(entry.shirtNumber), `${label}: shirtNumber must be an integer or null`);
    const entryKey = `${entry.countryId}\u0000${entry.tournamentId}\u0000${entry.playerId}`;
    check(!entryKeys.has(entryKey), `${label}: duplicate country/tournament/player tuple`);
    entryKeys.add(entryKey);
    tournamentsByCountry.get(entry.countryId).add(entry.tournamentId);
    entryCountByTournament.set(entry.tournamentId, entryCountByTournament.get(entry.tournamentId) + 1);
    const groupKey = `${entry.countryId}\u0000${entry.tournamentId}`;
    entriesByCountryTournament.set(groupKey, (entriesByCountryTournament.get(groupKey) ?? 0) + 1);
  });
  for (const [countryId, countryTournaments] of tournamentsByCountry) {
    check(countryTournaments.size > 0, `countries.json: country ${countryId} has no tournaments`);
  }
  for (const [tournamentIdValue, count] of entryCountByTournament) {
    check(count > 0, `tournaments.json: tournament ${tournamentIdValue} has no squad entries`);
  }

  const generatedJson = [
    ['countries.json', countries],
    ['tournaments.json', tournaments],
    ['players.json', players],
    ['squad-entries.json', squadEntries],
    ['extraction-report.json', extractionReport],
  ];
  generatedJson.forEach(([label, value]) => checkCamelCase(value, label));

  const pageFiles = fs.readdirSync(rawHtml).filter((name) => name.endsWith(pageSuffix)).sort();
  check(pageFiles.length === 19, `data/raw/html: expected 19 country pages, found ${pageFiles.length}`);
  const rawPages = pageFiles.map(rawPageExpectation);
  for (const page of rawPages) {
    check(countryMap.has(page.countryId), `${page.countryId}: raw page has no canonical country`);
    for (const header of page.headers) {
      check(tournamentMap.has(header.tournamentId), `${page.countryId}: raw tournament ${header.label} has no canonical tournament`);
      const actual = entriesByCountryTournament.get(`${page.countryId}\u0000${header.tournamentId}`) ?? 0;
      check(actual === header.expectedEntries, `${page.countryId} ${header.label}: expected ${header.expectedEntries} squad entries from raw counts, found ${actual}`);
    }
    const canonicalTournamentIds = tournamentsByCountry.get(page.countryId);
    check(canonicalTournamentIds.size === page.headers.length, `${page.countryId}: raw page has ${page.headers.length} tournament columns, canonical data has ${canonicalTournamentIds.size}`);
  }

  const totalPlayerRows = rawPages.reduce((total, page) => total + page.playerRows, 0);
  check(totalPlayerRows === 8890, `golden total: expected 8890 raw player rows, found ${totalPlayerRows}`);
  const turkiye = rawPages.find((page) => page.countryId === 'turkiye');
  check(turkiye, 'golden total: Türkiye raw page is missing');
  const turkiyeEntries = squadEntries.filter((entry) => entry.countryId === 'turkiye');
  const turkiyePlayers = new Set(turkiyeEntries.map((entry) => entry.playerId));
  check(turkiyePlayers.size === 216, `golden Türkiye players: expected 216, found ${turkiyePlayers.size}`);
  check(turkiyeEntries.length === 304, `golden Türkiye squad records: expected 304, found ${turkiyeEntries.length}`);
  check(turkiye.headers.length === 14, `golden Türkiye tournaments: expected 14, found ${turkiye.headers.length}`);
  const brazil = rawPages.find((page) => page.countryId === 'brezilya');
  check(brazil, 'golden total: Brazil raw page is missing');
  check(brazil.playerRows === 902, `golden Brazil rows: expected 902, found ${brazil.playerRows}`);
  const brazilContinentalColumns = brazil.headers.filter((header) => header.type === 'continental').length;
  check(brazilContinentalColumns === 38, `Brazil raw archive continental columns: expected 38, found ${brazilContinentalColumns}`);
  check(brazil.headers.length === 75, `Brazil raw archive columns: expected 75 total, found ${brazil.headers.length}`);

  const byCountryDir = path.join(dist, 'by-country');
  const expectedViewFiles = [...countryMap.keys()].sort().map((countryId) => `${countryId}.json`);
  const actualViewFiles = fs.readdirSync(byCountryDir).filter((name) => name.endsWith('.json')).sort();
  check(isDeepStrictEqual(actualViewFiles, expectedViewFiles), `by-country: expected files ${expectedViewFiles.join(', ')}, found ${actualViewFiles.join(', ')}`);
  for (const countryId of [...countryMap.keys()].sort()) {
    const relativePath = `by-country/${countryId}.json`;
    const view = readJson(relativePath);
    const expectedEntries = squadEntries.filter((entry) => entry.countryId === countryId);
    const expectedTournamentIds = new Set(expectedEntries.map((entry) => entry.tournamentId));
    const expectedPlayerIds = new Set(expectedEntries.map((entry) => entry.playerId));
    const expectedView = {
      country: countryMap.get(countryId),
      tournaments: [...expectedTournamentIds].sort().map((id) => tournamentMap.get(id)),
      players: [...expectedPlayerIds].sort().map((id) => playerMap.get(id)),
      squadEntries: expectedEntries,
    };
    check(isDeepStrictEqual(view, expectedView), `${relativePath}: denormalised view differs from canonical files`);
    checkCamelCase(view, relativePath);
  }

  console.log(`validation: clean (countries=${countries.length} tournaments=${tournaments.length} players=${players.length} rows=${totalPlayerRows} entries=${squadEntries.length})`);
}


try {
  validate();
} catch (error) {
  console.error(`validation: failed: ${error.message}`);
  process.exitCode = 1;
}
