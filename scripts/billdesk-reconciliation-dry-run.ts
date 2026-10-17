import { open } from 'node:fs/promises';
import { planBilldeskReconciliation, type ReconciliationRow } from '../lib/billdesk-reconciliation';

// Offline, explicit metadata input only. Does not load .env, query a database,
// call Retrieve, mutate orders, schedule refunds or enable another payment.
async function main() {
  const [file, instant] = process.argv.slice(2);
  if (!file || !instant) throw new Error();
  const handle = await open(file, 'r');
  let rows: unknown;
  try {
    if ((await handle.stat()).size > 1024 * 1024) throw new Error();
    rows = JSON.parse(await handle.readFile('utf8'));
  } finally { await handle.close(); }
  if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !row ||
    Object.keys(row).sort().join(',') !== 'createdAt,gateway,orderId,status' ||
    Object.values(row).some(value => typeof value !== 'string'))) throw new Error();
  // Deliberately no policy override: an approved operational runner is separate.
  const plan = planBilldeskReconciliation(rows as ReconciliationRow[], new Date(instant));
  const counts: Record<string, number> = {};
  for (const item of plan) counts[item.reason] = (counts[item.reason] || 0) + 1;
  console.log(JSON.stringify({ dryRun: true, dispatch: false, rows: plan.length, counts }));
}
main().catch(() => { console.error('Dry-run input unavailable or invalid; no operations dispatched.'); process.exitCode = 1; });
