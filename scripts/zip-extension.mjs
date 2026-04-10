#!/usr/bin/env node
/**
 * Упаковывает содержимое dist/ в ZIP: в корне архива — index.html, manifest.json, assets/…
 * (та же структура, что при «Загрузить распакованное расширение» → выбор папки dist).
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const manifestPath = path.join(root, 'public', 'manifest.json');

if (!existsSync(distDir) || !existsSync(path.join(distDir, 'index.html'))) {
  console.error('Ошибка: нет собранного расширения. Сначала выполните: npm run build:ext');
  process.exit(1);
}

let version = '0.0.0';
try {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  version = typeof m.version === 'string' ? m.version : version;
} catch {
  /* оставить 0.0.0 */
}

const releaseDir = path.join(root, 'release');
mkdirSync(releaseDir, { recursive: true });
const zipName = `windesk-bookmarks-${version}.zip`;
const zipPath = path.join(releaseDir, zipName);

const output = createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('warning', (err) => {
  if (err.code !== 'ENOENT') console.warn(err);
});
archive.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

output.on('close', () => {
  const bytes = archive.pointer();
  console.log(`Готово: ${zipPath}`);
  console.log(`Размер: ${bytes} байт`);
  console.log('');
  console.log('Распакуйте архив и в chrome://extensions укажите получившуюся папку (в ней должен лежать index.html).');
});

archive.pipe(output);
archive.directory(distDir, false);

await archive.finalize();
