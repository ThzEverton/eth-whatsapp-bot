import { readFile } from 'node:fs/promises';
import { extensionPackage } from './extension-package.mjs';

// Validate the current standalone dashboard assets without injecting obsolete HTML.
// The previous synchronizer expected inline <style> and legacy account controls,
// which were removed when the dashboard was split into separate CSS/JS modules.
const directory = new URL('./', import.meta.url);
const files = ['index.html', 'ui.css', 'monitor-ui.js', 'management.js'];
for (const file of files) {
  const content = await readFile(new URL(file, directory), 'utf8');
  if (!content.trim()) throw new Error(`Arquivo do painel vazio: ${file}`);
}
const html = await readFile(new URL('index.html', directory), 'utf8');
for (const resource of ['/ui.css', '/monitor-ui.js', '/management.js']) {
  if (!html.includes(resource)) throw new Error(`Recurso nao referenciado: ${resource}`);
}
const archive = await extensionPackage();
if (!archive.length) throw new Error('Pacote da extensao vazio');
console.log('Painel e pacote da extensao verificados.');
