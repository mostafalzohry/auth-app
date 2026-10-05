import type { Response } from 'express';

export function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, '');
}

export function reject(res: Response, status: number, message: string): void {
  res.status(status).json({ statusCode: status, message });
}
