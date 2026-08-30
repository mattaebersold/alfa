#!/usr/bin/env node
/**
 * Bumps the app's version in package.json and app.json together.
 *
 * The scheme here is two-part and not semver — 1.29, 1.30, 1.31 — so `npm
 * version` refuses it outright. The minor is treated as a plain integer, which
 * is what makes 1.9 go to 1.10 rather than to 1.91.
 *
 * Build numbers aren't touched: eas.json sets appVersionSource "remote" with
 * autoIncrement on production, so EAS owns iOS buildNumber and Android
 * versionCode.
 *
 *   node scripts/bump-version.js        → 1.31 becomes 1.32
 *   node scripts/bump-version.js 2.0    → sets it to exactly 2.0
 */
const fs = require('fs');
const path = require('path');

const FILES = ['package.json', 'app.json'];
const VERSION_LINE = /("version":\s*")([^"]+)(")/;

const root = path.join(__dirname, '..');
const explicit = process.argv[2];

// Read package.json first — it's the one that decides what "current" is, so a
// hand-edit that leaves the two files disagreeing is reported rather than
// silently picked from whichever file was read first.
const contents = FILES.map((file) => {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, 'utf8');
  const match = text.match(VERSION_LINE);
  if (!match) {
    console.error(`No "version" field found in ${file}.`);
    process.exit(1);
  }
  return { file, full, text, version: match[2] };
});

const [pkg, app] = contents;
if (pkg.version !== app.version) {
  console.warn(`Warning: package.json is ${pkg.version} but app.json is ${app.version}. Bumping from ${pkg.version}.`);
}

let next = explicit;
if (!next) {
  const parts = pkg.version.split('.');
  const last = Number(parts[parts.length - 1]);
  if (!Number.isInteger(last)) {
    console.error(`Can't bump "${pkg.version}" — the last segment isn't a whole number. Pass one explicitly: node scripts/bump-version.js 1.32`);
    process.exit(1);
  }
  parts[parts.length - 1] = String(last + 1);
  next = parts.join('.');
}

for (const { file, full, text } of contents) {
  // Replacing the line rather than re-serialising the JSON: app.json is hand
  // formatted, and a round trip through JSON.stringify would rewrite the whole
  // file for a two-character change.
  fs.writeFileSync(full, text.replace(VERSION_LINE, `$1${next}$3`));
  console.log(`  ${file}: ${next}`);
}

console.log(`\nVersion is now ${next}. Commit with:\n  git commit -am "${next}"`);
