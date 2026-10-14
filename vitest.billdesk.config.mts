import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// ESM avoids the repository's CJS config loader incompatibility with std-env.
// All BillDesk tests use synthetic values and block network access.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/billdesk*.test.ts', 'tests/unit/validations.test.ts', 'tests/unit/invoice.test.ts'],
    passWithNoTests: false,
  },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)), 'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)) } },
});
