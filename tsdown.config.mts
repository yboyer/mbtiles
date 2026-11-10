import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  fixedExtension: false,
  platform: 'node',
  sourcemap: true,
  dts: { sourcemap: true },
  deps: { neverBundle: ['better-sqlite3'] },
  report: { summary: true },
})
