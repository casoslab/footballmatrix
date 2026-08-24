#!/usr/bin/env node
// Enforces the path naming rules documented in docs/naming-conventions.md.
// Dependency-free on purpose: CI can run it before any install step.

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const SKIP_DIRS = new Set([".git", "node_modules", ".expo", "dist", ".astro", "__pycache__"]);

// Provenance archive: original filenames are intentionally preserved.
const EXEMPT_PREFIXES = ["data/raw/"];

// Names fixed by external tooling or community convention.
const EXEMPT_NAMES = new Set([
  "README.md",
  "LICENSE",
  "LICENSE-DATA",
  "NOTICE",
  "ATTRIBUTION.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "CLAUDE.md",
  "AGENTS.md",
  "Makefile",
  "Dockerfile",
]);

const SEGMENT = /^\.?[a-z0-9]+(-[a-z0-9]+)*$/;
const COMPOUND_EXT = /^(d\.ts|config\.(js|mjs|cjs|ts)|test\.(ts|tsx|js)|spec\.(ts|tsx|js))$/;

function checkName(name, isDir) {
  if (EXEMPT_NAMES.has(name)) return null;

  if (isDir) {
    return SEGMENT.test(name) ? null : "directory name is not kebab-case";
  }

  const dot = name.indexOf(".", name.startsWith(".") ? 1 : 0);
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot + 1);

  if (!SEGMENT.test(stem)) return "file stem is not kebab-case";
  if (ext && !/^[a-z0-9]+$/.test(ext) && !COMPOUND_EXT.test(ext)) {
    return `unexpected extension ".${ext}"`;
  }
  return null;
}

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split(sep).join("/");
    const isDir = statSync(full).isDirectory();

    if (isDir && SKIP_DIRS.has(entry)) continue;
    if (EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
      if (isDir) walk(full);
      continue;
    }

    const problem = checkName(entry, isDir);
    if (problem) violations.push(`${rel}: ${problem}`);
    if (isDir) walk(full);
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error(`naming: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log("naming: clean");
