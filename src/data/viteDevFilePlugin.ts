import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { emptyWorkbook } from './xlsxWorkbook';

export type FileMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

function isMondayIso(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(ms);
  if (date.toISOString().slice(0, 10) !== value) {
    return false;
  }
  return date.getUTCDay() === 1;
}

function sendText(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

export function createFileMiddleware(menuFilePath: string, listsDir: string): FileMiddleware {
  return (req, res, next) => {
    const parsed = new URL(req.url ?? '', 'http://localhost');
    const pathname = parsed.pathname;

    if (pathname === '/api/menu') {
      if (req.method === 'GET') {
        if (!existsSync(menuFilePath)) {
          writeFileSync(menuFilePath, Buffer.from(emptyWorkbook()));
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.end(readFileSync(menuFilePath));
        return;
      }
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          writeFileSync(menuFilePath, Buffer.concat(chunks));
          sendText(res, 200, 'ok');
        });
        return;
      }
      next();
      return;
    }

    if (pathname === '/api/lista') {
      const week = parsed.searchParams.get('week') ?? '';
      if (!isMondayIso(week)) {
        sendText(res, 400, 'invalid week');
        return;
      }
      const filePath = path.join(listsDir, `lista_${week}.txt`);
      if (req.method === 'GET') {
        if (!existsSync(filePath)) {
          sendText(res, 404, 'not found');
          return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(filePath));
        return;
      }
      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          writeFileSync(filePath, Buffer.concat(chunks));
          sendText(res, 200, 'ok');
        });
        return;
      }
      next();
      return;
    }

    next();
  };
}