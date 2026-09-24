import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { emptyWorkbook } from './xlsxWorkbook';

export type FileMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

export function createFileMiddleware(filePath: string): FileMiddleware {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (url !== '/api/menu' && !url.startsWith('/api/menu?')) {
      next();
      return;
    }

    if (req.method === 'GET') {
      if (!existsSync(filePath)) {
        writeFileSync(filePath, Buffer.from(emptyWorkbook()));
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.end(readFileSync(filePath));
      return;
    }

    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        writeFileSync(filePath, Buffer.concat(chunks));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('ok');
      });
      return;
    }

    next();
  };
}