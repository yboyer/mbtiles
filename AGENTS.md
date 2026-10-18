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

Use the Vite+ CLI (`vp`); dependencies are locked in `package-lock.json`.
Tool versions and configuration are defined in `package.json`, `tsconfig.json`,
and `vite.config.ts`.

- `vp install`: install dependencies.
- `vp check`: check formatting, lint, and types.
- `vp test`: run tests with coverage enabled in `vite.config.ts`.
- `vp run build`: bundle the library and generate declarations via `vp pack`.
  Use this project script for library builds.

Validate changes with `vp check`, `vp test`, and `vp run build`.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
