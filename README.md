# @yboyer/mbtiles

A TypeScript library for reading [MBTiles](https://wiki.openstreetmap.org/wiki/MBTiles) files using [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## Installation

```sh
npm install @yboyer/mbtiles
```

## Usage

```ts
import { MBTilesReader } from '@yboyer/mbtiles'

const reader = new MBTilesReader('/path/to/file.mbtiles')

// Retrieve a tile
const tile = reader.getTile(z, x, y)
if (tile) {
  console.log(tile.data)    // Buffer
  console.log(tile.headers) // Content-Type, Content-Encoding, ETag, Last-Modified
}

// Retrieve metadata
const info = reader.getInfos()
console.log(info) // { scheme, minzoom, maxzoom, center, bounds, ... }
```

## API

### `new MBTilesReader(file, debug?)`

Opens an MBTiles SQLite file in read-only mode.

| Parameter | Type      | Description                              |
|-----------|-----------|------------------------------------------|
| `file`    | `string`  | Path to the `.mbtiles` file              |
| `debug`   | `boolean` | Enable verbose SQLite logging (optional) |

### `getTile(z, x, y): GetTileResponse | null`

Returns the tile at the given zoom level and coordinates, or `null` if not found.

The Y coordinate is automatically flipped from XYZ to TMS convention.

Supported tile formats: PNG, JPEG, GIF, WebP, PBF (gzip / deflate compressed).

**Response shape:**

```ts
{
  data: Buffer
  headers: {
    'Content-Type': string
    'Content-Encoding'?: string   // 'gzip' | 'deflate' for PBF tiles
    'Last-Modified'?: string
    ETag?: string
  }
}
```

### `getInfos(): Info | null`

Returns the metadata stored in the MBTiles file, or `null` if empty.

```ts
{
  scheme: string      // defaults to 'xyz'
  minzoom: number
  maxzoom: number
  center: number[]
  bounds: number[]
  [key: string]: unknown
}
```

### `MBTilesReader.checkFile(file)`

Static helper that opens the file and throws if it is invalid or missing.

## Development

```sh
npm run build   # Compile TypeScript
npm run lint    # Lint with Biome
```

## License

ISC
