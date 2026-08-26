import {
  readFile,
  writeFile,
  readdir,
} from 'node:fs/promises';

import {
  resolve,
  extname,
} from 'node:path';

const root = process.cwd();

const resultsDir =
  resolve(
    root,
    'performance',
    'results',
  );

const secretKeys =
  new Set([
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'authorization',
    'password',
    'clientsecret',
    'apikey',
  ]);

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    const result = {};

    for (
      const [key, nestedValue]
      of Object.entries(value)
    ) {
      const normalizedKey =
        key
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();

      if (
        secretKeys.has(
          normalizedKey,
        )
      ) {
        continue;
      }

      result[key] =
        sanitize(nestedValue);
    }

    return result;
  }

  return value;
}

const entries =
  await readdir(
    resultsDir,
    {
      withFileTypes: true,
    },
  );

let sanitizedFiles = 0;

for (const entry of entries) {
  if (
    !entry.isFile() ||
    extname(entry.name) !== '.json'
  ) {
    continue;
  }

  const filePath =
    resolve(
      resultsDir,
      entry.name,
    );

  const raw =
    await readFile(
      filePath,
      'utf8',
    );

  const normalized =
    raw.replace(/^\uFEFF/, '');

  const parsed =
    JSON.parse(normalized);

  const clean =
    sanitize(parsed);

  await writeFile(
    filePath,
    `${JSON.stringify(clean, null, 2)}\n`,
    'utf8',
  );

  sanitizedFiles += 1;

  console.log(
    `sanitized: ${entry.name}`,
  );
}

console.log(
  `Sanitized JSON files: ${sanitizedFiles}`,
);