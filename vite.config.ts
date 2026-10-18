import config from '@yboyer/config/vite-plus'
import { defineConfig, mergeConfig } from 'vite-plus'

export default defineConfig(
  mergeConfig(config, {
    test: {
      coverage: {
        enabled: true,
        thresholds: { 100: true },
      },
    },
    pack: {
      format: 'cjs',
      fixedExtension: false,
      sourcemap: true,
      report: {
        summary: true,
      },
    },
    staged: {
      '*': 'vp check --fix',
    },
    lint: {
      env: { node: true },
      overrides: [
        {
          files: ['benchmark/**/*.mjs'],
          rules: { 'no-console': 'off' },
        },
      ],
    },
  })
)
