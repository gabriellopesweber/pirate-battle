import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests cover pure game rules (simulation, collisions, config validation).
// Browser behaviour is covered by Playwright in tests/e2e.
//
// Each test lives next to the code it tests, in a `test/` folder:
// src/game/core/rng.ts → src/game/core/test/rng.test.ts. The include matches
// exactly that convention: a test file outside a `test/` folder is not run,
// and nothing warns about it.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
