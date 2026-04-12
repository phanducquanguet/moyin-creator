import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');
const BASE_LOCALE = 'vi';
const TARGET_LOCALES = ['en'];
const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+)\}/g;

function extractPlaceholders(text) {
  const names = new Set();
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    names.add(match[1]);
  }
  return Array.from(names).sort();
}

function diffList(base, other) {
  const baseSet = new Set(base);
  return other.filter((item) => !baseSet.has(item));
}

function sortKeys(record) {
  return Object.keys(record).sort();
}

async function loadLocale(name) {
  const filePath = path.join(LOCALES_DIR, `${name}.json`);
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

function validateEmptyStrings(localeName, dict, errors) {
  for (const [key, value] of Object.entries(dict)) {
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`[${localeName}] Key "${key}" has empty or invalid translation value.`);
    }
  }
}

function validatePlaceholders(baseDict, localeName, localeDict, errors) {
  for (const [key, baseValue] of Object.entries(baseDict)) {
    const targetValue = localeDict[key];
    if (typeof targetValue !== 'string') continue;
    const basePlaceholders = extractPlaceholders(baseValue);
    const targetPlaceholders = extractPlaceholders(targetValue);
    if (basePlaceholders.join('|') !== targetPlaceholders.join('|')) {
      errors.push(
        `[${localeName}] Key "${key}" placeholder mismatch: base=[${basePlaceholders.join(', ')}], target=[${targetPlaceholders.join(', ')}]`,
      );
    }
  }
}

async function main() {
  const errors = [];
  const baseDict = await loadLocale(BASE_LOCALE);
  const baseKeys = sortKeys(baseDict);

  validateEmptyStrings(BASE_LOCALE, baseDict, errors);

  for (const locale of TARGET_LOCALES) {
    const dict = await loadLocale(locale);
    const keys = sortKeys(dict);

    validateEmptyStrings(locale, dict, errors);

    const missing = diffList(keys, baseKeys);
    const extra = diffList(baseKeys, keys);

    if (missing.length > 0) {
      errors.push(`[${locale}] Missing keys (${missing.length}): ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      errors.push(`[${locale}] Extra keys (${extra.length}): ${extra.join(', ')}`);
    }

    validatePlaceholders(baseDict, locale, dict, errors);
  }

  if (errors.length > 0) {
    console.error('i18n validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('i18n validation passed.');
}

main().catch((error) => {
  console.error('Failed to run i18n validation:', error);
  process.exit(1);
});
