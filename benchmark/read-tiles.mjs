import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MBTilesReader } from '@yboyer/mbtiles'
import Database from 'better-sqlite3'
import { PMTiles } from 'pmtiles'
import { Bench } from 'tinybench'

import { LocalPmtilesSource } from './local-pmtiles-source.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = __dirname

const SAMPLE_SIZE = 2000

const assets = {
  mbtiles: resolve(projectRoot, 'data/generated/limousin.mbtiles'),
  pmtiles: resolve(projectRoot, 'data/generated/limousin.pmtiles'),
}

function failMissingAssets(error) {
  if (error && error.code === 'ENOENT') {
    throw new Error(
      'Benchmark assets are missing. Run "npm run prepare-assets" before "npm run benchmark".'
    )
  }

  throw error
}

function buildSample(mbtilesPath, targetSize) {
  let database

  try {
    database = new Database(mbtilesPath, { readonly: true, fileMustExist: true })
  } catch (error) {
    failMissingAssets(error)
  }

  try {
    const rows = database
      .prepare(
        `
          SELECT
            zoom_level AS z,
            tile_column AS x,
            ((1 << zoom_level) - 1 - tile_row) AS y
          FROM tiles
          ORDER BY zoom_level, tile_column, tile_row
        `
      )
      .all()

    if (rows.length <= targetSize) {
      return rows
    }

    const sample = []
    const step = rows.length / targetSize

    for (let index = 0; index < targetSize; index += 1) {
      sample.push(rows[Math.floor(index * step)])
    }

    return sample
  } finally {
    database.close()
  }
}

function readMbtilesSample(reader, sample) {
  let totalBytes = 0

  for (const { z, x, y } of sample) {
    const tile = reader.getTile(z, x, y)

    if (!tile) {
      throw new Error(`MBTiles is missing tile ${z}/${x}/${y}`)
    }

    totalBytes += tile.data.byteLength
  }

  return totalBytes
}

async function readPmtilesSample(reader, sample) {
  const results = await Promise.all(
    sample.map(async ({ z, x, y }) => {
      const tile = await reader.getZxy(z, x, y)

      if (!tile) {
        throw new Error(`PMTiles is missing tile ${z}/${x}/${y}`)
      }

      return tile.data.byteLength
    })
  )

  return results.reduce((sum, bytes) => sum + bytes, 0)
}

async function main() {
  const sample = buildSample(assets.mbtiles, SAMPLE_SIZE)
  const mbtilesReader = new MBTilesReader(assets.mbtiles)
  const pmtilesSource = new LocalPmtilesSource(assets.pmtiles)
  await pmtilesSource._ready
  const pmtilesReader = new PMTiles(pmtilesSource)

  try {
    const [mbtilesBytes, pmtilesBytes] = await Promise.all([
      Promise.resolve(readMbtilesSample(mbtilesReader, sample)),
      readPmtilesSample(pmtilesReader, sample),
    ])

    if (mbtilesBytes === 0 || pmtilesBytes === 0) {
      throw new Error('Sample validation returned zero bytes for at least one archive.')
    }

    const bench = new Bench({
      retainSamples: true,
    })

    bench.add('@yboyer/mbtiles read sample', () => {
      readMbtilesSample(mbtilesReader, sample)
    })

    bench.add('pmtiles read sample (parallel)', async () => {
      await readPmtilesSample(pmtilesReader, sample)
    })

    await bench.run()

    console.log(`Sample size: ${sample.length} tiles`)
    console.log(`Validated bytes: mbtiles=${mbtilesBytes}, pmtiles=${pmtilesBytes}`)
    console.table(bench.table())
  } finally {
    await pmtilesSource.close()
  }
}

main().catch(error => {
  if (error instanceof Error && error.message.includes('Benchmark assets are missing')) {
    console.error(error.message)
    process.exitCode = 1
    return
  }

  failMissingAssets(error)
})
