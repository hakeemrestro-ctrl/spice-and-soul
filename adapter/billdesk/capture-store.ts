import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { captureDigest } from './capture-protocol';
type DB = { exec(sql: string): void; prepare(sql: string): { run(...v: unknown[]): unknown; get(...v: unknown[]): unknown }; close(): void };
/** Dedicated capture-only SQLite file; never use adapter/payment state here. */
export class CaptureStore {
  private db: DB;
  constructor(path: string) {
    const { DatabaseSync } = createRequire(resolve('package.json'))('node:sqlite');
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;
      CREATE TABLE IF NOT EXISTS capture_nonces (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS captured_mail (id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL);`);
  }
  capture(id: string, payload: string, nonce: string, now: number) {
    try {
      this.db.exec('BEGIN IMMEDIATE');
      this.db.prepare('DELETE FROM capture_nonces WHERE expires < ?').run(now);
      this.db.prepare('INSERT INTO capture_nonces VALUES (?, ?)').run(nonce, now + 300000);
      const digest = captureDigest(Buffer.from(payload));
      const previous = this.db.prepare('SELECT digest FROM captured_mail WHERE id=?').get(id) as { digest: string } | undefined;
      if (previous && previous.digest !== digest) throw new Error();
      if (!previous) {
        const size = this.db.prepare('SELECT coalesce(sum(length(CAST(payload AS BLOB))),0) AS bytes FROM captured_mail').get() as { bytes: number };
        if (size.bytes + Buffer.byteLength(payload) > 100 * 1024 * 1024) throw new Error();
        this.db.prepare('INSERT INTO captured_mail VALUES (?,?,?,?)').run(id, digest, payload, now);
      }
      this.db.exec('COMMIT');
      return { messageId: id, status: 'captured' as const, delivered: false as const };
    } catch {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw new Error('Capture persistence or replay review required');
    }
  }
  close() { this.db.close(); }
}
