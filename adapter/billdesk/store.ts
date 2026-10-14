import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { AdapterError } from './protocol';

// Node 24 built-in SQLite. No external database or production credentials.
type DB = { exec(sql: string): void; prepare(sql: string): { run(...v: unknown[]): unknown; get(...v: unknown[]): unknown }; close(): void };
export class NonceStore {
  private db: DB;
  constructor(path: string) {
    const { DatabaseSync } = createRequire(resolve('package.json'))('node:sqlite');
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;
      CREATE TABLE IF NOT EXISTS nonces (key TEXT, nonce TEXT, expires INTEGER NOT NULL, PRIMARY KEY(key,nonce));
      CREATE TABLE IF NOT EXISTS operations (key TEXT, id TEXT, fingerprint TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(key,id));`);
  }
  consume(key: string, nonce: string, now: number) {
    try {
      this.db.exec('BEGIN IMMEDIATE');
      this.db.prepare('DELETE FROM nonces WHERE expires < ?').run(now);
      if (this.db.prepare('SELECT 1 FROM nonces WHERE key=? AND nonce=?').get(key, nonce)) throw new AdapterError('REPLAY', 409);
      this.db.prepare('INSERT INTO nonces VALUES (?,?,?)').run(key, nonce, now + 300000);
      this.db.exec('COMMIT');
    } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} if (e instanceof AdapterError) throw e; throw new AdapterError('NONCE_STORE_UNAVAILABLE', 503); }
  }
  claim(key: string, id: string, fingerprint: string) {
    try {
      this.db.exec('BEGIN IMMEDIATE');
      if (this.db.prepare('SELECT 1 FROM operations WHERE key=? AND id=?').get(key, id)) throw new AdapterError('OPERATION_ALREADY_ATTEMPTED', 409);
      this.db.prepare('INSERT INTO operations VALUES (?,?,?,?)').run(key, id, fingerprint, 'started');
      this.db.exec('COMMIT');
    } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} if (e instanceof AdapterError) throw e; throw new AdapterError('OPERATION_STORE_UNAVAILABLE', 503); }
  }
  finish(key: string, id: string, state: 'responded' | 'unknown') {
    try { this.db.prepare('UPDATE operations SET state=? WHERE key=? AND id=?').run(state, key, id); }
    catch { throw new AdapterError('OPERATION_STORE_UNAVAILABLE', 503); }
  }
  close() { this.db.close(); }
}
export class Limits {
  private clients = new Map<string, { tokens: number; at: number }>();
  private active = 0;
  enter(key: string, now: number) {
    const state = this.clients.get(key) ?? { tokens: 5, at: now };
    state.tokens = Math.min(5, state.tokens + Math.max(0, now - state.at) / 2000); state.at = now;
    this.clients.set(key, state);
    if (state.tokens < 1) throw new AdapterError('RATE_LIMIT', 429);
    if (this.active >= 4) throw new AdapterError('CONCURRENCY_LIMIT', 429);
    state.tokens--; this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}
