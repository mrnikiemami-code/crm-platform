const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

http
  .createServer((request, response) => {
    const requested = decodeURIComponent((request.url || '/').split('?')[0]);
    const file = path.join(root, requested === '/' ? '/b-rail.html' : requested);
    if (!file.startsWith(root)) {
      response.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(body);
    });
  })
  .listen(4399, '127.0.0.1', () => console.log('designs on http://127.0.0.1:4399'));
