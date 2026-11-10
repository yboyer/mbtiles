# Project Guide

`@yboyer/mbtiles` is a TypeScript library for reading MBTiles files through
`better-sqlite3`. Read [README.md](README.md) for the public API before changing it.

## Repository Layout

- `src/`: library implementation.
- `test/`: library tests.
- `benchmark/`: performance comparison with PMTiles; read
  [benchmark/README.md](benchmark/README.md) before working on benchmarks.
- `dist/`: generated library bundle and TypeScript declarations.

## Project Commands

Use npm; dependencies are locked in `package-lock.json`.
Use the Node.js version in `.node-version`.
Tool configuration is defined in `biome.json`, `tsconfig.json`,
`tsdown.config.mts`, and `vitest.config.mts`.

- `npm ci`: install dependencies from the lockfile.
- `npm run lint`: check formatting, lint, and library, test, and tool configuration types without changing files.
- `npm test`: run existing tests with 100% coverage thresholds.
- `npm run build`: bundle CommonJS and generate declarations and source maps.

Validate changes with `npm run lint`, `npm run build`, and `npm test`.
