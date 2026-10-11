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
    setupFiles: ['src/test-utils/setup.ts'],
    // Above Testing Library's 5 s wait (src/test-utils/setup.ts), so a slow
    // wait fails as a wait — with its message — rather than as a test timeout.
    testTimeout: 15_000,
  },
})
