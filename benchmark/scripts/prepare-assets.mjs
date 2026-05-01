import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const directories = {
  data: resolve(projectRoot, 'data'),
  source: resolve(projectRoot, 'data/source'),
  generated: resolve(projectRoot, 'data/generated'),
}

const assets = {
  pbf: resolve(directories.source, 'limousin-latest.osm.pbf'),
  filteredPbf: resolve(directories.generated, 'limousin-roads.osm.pbf'),
  geojsonseq: resolve(directories.generated, 'limousin.geojsonseq'),
  mbtiles: resolve(directories.generated, 'limousin.mbtiles'),
  pmtiles: resolve(directories.generated, 'limousin.pmtiles'),
}

const sourceUrl = 'https://download.geofabrik.de/europe/france/limousin-latest.osm.pbf'

const layerName = 'limousin'

function log(message) {
  process.stdout.write(`${message}\n`)
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function ensureDirectories() {
  await Promise.all(
    Object.values(directories).map(directory => mkdir(directory, { recursive: true }))
  )
}

async function downloadIfMissing(url, destination) {
  if (await pathExists(destination)) {
    log(`Reusing existing source file: ${destination}`)
    return
  }

  log(`Downloading ${url}`)
  const response = await fetch(url)

  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${url}: ${response.status} ${response.statusText}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
    })

    child.on('error', rejectPromise)
    child.on('exit', code => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${command} exited with code ${code}`))
    })
  })
}

async function ensureFilteredPbf() {
  if (await pathExists(assets.filteredPbf)) {
    log(`Reusing existing filtered PBF: ${assets.filteredPbf}`)
    return
  }

  log('Filtering OSM PBF to roads only with osmium')
  await run('osmium', [
    'tags-filter',
    assets.pbf,
    'w/highway',
    '--overwrite',
    '--output',
    assets.filteredPbf,
  ])
}

async function ensureGeoJsonSeq() {
  if (await pathExists(assets.geojsonseq)) {
    log(`Reusing existing GeoJSON sequence: ${assets.geojsonseq}`)
    return
  }

  log('Converting filtered PBF to GeoJSON sequence with osmium')
  await run('osmium', [
    'export',
    assets.filteredPbf,
    '--overwrite',
    '--format',
    'geojsonseq',
    '--output',
    assets.geojsonseq,
  ])
}

async function ensureTilesArchive(outputPath) {
  if (await pathExists(outputPath)) {
    log(`Reusing existing archive: ${outputPath}`)
    return
  }

  log(`Generating ${outputPath}`)
  await run('tippecanoe', [
    '-f',
    '-zg',
    '--drop-densest-as-needed',
    '--extend-zooms-if-still-dropping',
    '--read-parallel',
    '--layer',
    layerName,
    '--output',
    outputPath,
    assets.geojsonseq,
  ])
}

async function main() {
  await ensureDirectories()
  await downloadIfMissing(sourceUrl, assets.pbf)
  await ensureFilteredPbf()
  await ensureGeoJsonSeq()
  await ensureTilesArchive(assets.mbtiles)
  await ensureTilesArchive(assets.pmtiles)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
