import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const envPath = path.resolve(frontendDirectory, '..', '.env');
const indexPath = path.resolve(frontendDirectory, 'dist', 'storefront', 'browser', 'index.html');

function parseEnv(source) {
  const values = {};

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function escapeHtmlAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

let fileEnv = {};
try {
  fileEnv = parseEnv(await readFile(envPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const verificationToken = (
  process.env.PINTEREST_DOMAIN_VERIFY ?? fileEnv.PINTEREST_DOMAIN_VERIFY ?? ''
).trim();

let indexHtml = await readFile(indexPath, 'utf8');
indexHtml = indexHtml.replace(
  /\s*<meta\s+name=["']p:domain_verify["'][^>]*>/gi,
  '',
);

if (verificationToken) {
  const verificationTag = `    <meta name="p:domain_verify" content="${escapeHtmlAttribute(verificationToken)}">\n`;
  indexHtml = indexHtml.replace(/(<head>\s*)/i, `$1${verificationTag}`);
  console.log('Pinterest domain verification tag injected.');
} else {
  console.log('PINTEREST_DOMAIN_VERIFY is empty; verification tag omitted.');
}

await writeFile(indexPath, indexHtml, 'utf8');
