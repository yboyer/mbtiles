import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  fixedExtension: false,
  platform: 'node',
  sourcemap: true,
  dts: { sourcemap: true },
  report: { summary: true },
})
