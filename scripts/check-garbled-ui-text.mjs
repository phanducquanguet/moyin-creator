import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'src', 'components');
const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);

const BROKEN_PATTERNS = [
  /Đã rồi/u,
  /trongcủa/u,
  /mộtxe kéo/u,
  /bốncung điện/u,
];

const UNICODE_ESCAPE_RE = /\\u[0-9a-fA-F]{4}/;
const UNICODE_ESCAPE_ALLOWLIST_RE = [
  /\\u4e00/i,
  /\\u9fa5/i,
  /replace\(/,
  /RegExp\(/,
];

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isAllowedUnicodeEscape(line) {
  return UNICODE_ESCAPE_ALLOWLIST_RE.some((pattern) => pattern.test(line));
}

async function main() {
  const files = await collectFiles(TARGET_DIR);
  const issues = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      for (const pattern of BROKEN_PATTERNS) {
        if (pattern.test(line)) {
          issues.push({
            filePath,
            lineNumber: index + 1,
            reason: `Found broken mixed-language pattern: ${pattern}`,
          });
        }
      }

      if (UNICODE_ESCAPE_RE.test(line) && !isAllowedUnicodeEscape(line)) {
        issues.push({
          filePath,
          lineNumber: index + 1,
          reason: 'Found suspicious unicode escape in UI code',
        });
      }
    });
  }

  if (issues.length > 0) {
    console.error('UI garbled text validation failed:');
    for (const issue of issues) {
      console.error(`- ${issue.filePath}:${issue.lineNumber} ${issue.reason}`);
    }
    process.exit(1);
  }

  console.log('UI garbled text validation passed.');
}

main().catch((error) => {
  console.error('Failed to run UI garbled text validation:', error);
  process.exit(1);
});
