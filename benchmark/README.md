# Benchmark

Compare read performance between the `@yboyer/mbtiles` reader and the `pmtiles` library on a real-world dataset (Limousin road network from OpenStreetMap).

## What it does

1. **Prepares assets** (`scripts/prepare-assets.mjs`) — downloads the Limousin OSM extract, filters it to roads only, converts it to GeoJSON, then generates both a `.mbtiles` and a `.pmtiles` archive using `tippecanoe`.
2. **Runs the benchmark** (`read-tiles.mjs`) — builds a sample of 2 000 tiles drawn evenly across all zoom levels, then measures how fast each reader can read the full sample:
   - `@yboyer/mbtiles` — synchronous reads via `better-sqlite3`
   - `pmtiles` — parallel async reads via a local file source

Results are printed as a table (ops/sec, average time, …) using [tinybench](https://github.com/tinylibs/tinybench).

```shell
> node ./benchmark/read-tiles.mjs

Sample size: 643 tiles
Validated bytes: mbtiles=23124198, pmtiles=46593855
┌─────────┬──────────────────────────────────┬────────────────────┬──────────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name                        │ Latency avg (ns)   │ Latency med (ns)     │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼──────────────────────────────────┼────────────────────┼──────────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ '@yboyer/mbtiles read sample'    │ '3093957 ± 3.15%'  │ '2553562 ± 223584'   │ '346 ± 2.59%'          │ '392 ± 36'             │ 324     │
│ 1       │ 'pmtiles read sample (parallel)' │ '69995985 ± 1.46%' │ '69058187 ± 2212563' │ '14 ± 1.37%'           │ '14 ± 0'               │ 64      │
└─────────┴──────────────────────────────────┴────────────────────┴──────────────────────┴────────────────────────┴────────────────────────┴─────────┘
```

## Prerequisites

The following CLI tools must be available in your `PATH`:

| Tool                                               | Purpose                                   | Install                    |
| -------------------------------------------------- | ----------------------------------------- | -------------------------- |
| [`osmium`](https://osmcode.org/osmium-tool/)       | Filter and convert OSM PBF files          | `brew install osmium-tool` |
| [`tippecanoe`](https://github.com/felt/tippecanoe) | Generate `.mbtiles` / `.pmtiles` archives | `brew install tippecanoe`  |

## Usage

```sh
npm run benchmark
```

Asset preparation is idempotent — already-generated files are reused on subsequent runs.
