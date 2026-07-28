import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT ?? 8081);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveRequest(url) {
  const rawPath = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
  const relativePath = safePath === '/' ? '/index.html' : safePath;
  const direct = join(root, relativePath);
  if (existsSync(direct)) {
    return direct;
  }
  if (!extname(relativePath)) {
    const routeFile = join(root, `${relativePath}.html`);
    if (existsSync(routeFile)) {
      return routeFile;
    }
  }
  return join(root, '+not-found.html');
}

createServer((request, response) => {
  const filePath = resolveRequest(request.url ?? '/');
  const extension = extname(filePath);
  response.writeHead(filePath.endsWith('+not-found.html') ? 404 : 200, {
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    'Cache-Control':
      extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Kanakana web build: http://127.0.0.1:${port}`);
});
