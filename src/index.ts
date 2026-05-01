import { statSync } from 'node:fs'

import Database from 'better-sqlite3'

//

type Info = {
  scheme: string
  minzoom: number
  maxzoom: number
  center: number[]
  bounds: number[]
  [key: string]: unknown
}

type GetTileResponse = {
  data: Buffer
  headers: {
    'Content-Type': string
    'Content-Encoding'?: string
    'Last-Modified'?: string
    ETag?: string
  }
}

/**
 * Reads tiles and metadata from an MBTiles SQLite file.
 *
 * Prepared statements are cached at construction time for optimal performance.
 * Call {@link close} when done to release the database connection.
 */
export class MBTilesReader {
  private db: Database.Database

  private lastModified: Date

  private size: number

  private getTileStmt: Database.Statement<number[], { tile_data: Buffer }>

  private getInfosStmt: Database.Statement<[], { name: string; value: string }>

  /**
   * @param file - Absolute or relative path to the `.mbtiles` file.
   * @param debug - When `true`, logs all SQL statements to `console.debug`.
   * @throws If the file does not exist or cannot be opened as a SQLite database.
   */
  constructor(file: string, debug?: boolean) {
    this.db = new Database(file, {
      // biome-ignore lint/suspicious/noConsole: fallback
      verbose: debug ? console.debug : undefined,
      readonly: true,
      fileMustExist: true,
    })

    const infos = statSync(file)
    this.lastModified = infos.mtime
    this.size = infos.size

    this.getTileStmt = this.db.prepare<number[], { tile_data: Buffer }>(
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
    )
    this.getInfosStmt = this.db.prepare<[], { name: string; value: string }>(
      'SELECT name, value FROM metadata'
    )
  }

  /** Closes the underlying SQLite database connection. */
  close(): void {
    this.db.close()
  }

  /**
   * Verifies that `file` is a valid, readable MBTiles database.
   * Throws if the file is missing, unreadable, or not a valid SQLite file.
   *
   * @param file - Path to the `.mbtiles` file to validate.
   */
  static checkFile(file: string): void {
    const reader = new MBTilesReader(file)
    reader.close()
  }

  private headers(buffer: Buffer): {
    'Content-Type': string
    'Content-Encoding'?: string
  } {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return {
        'Content-Type': 'image/png',
      }
    }
    if (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9
    ) {
      return {
        'Content-Type': 'image/jpeg',
      }
    }

    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x39 || buffer[4] === 0x37) &&
      buffer[5] === 0x61
    ) {
      return {
        'Content-Type': 'image/gif',
      }
    }

    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return {
        'Content-Type': 'image/webp',
      }
    }

    // deflate: recklessly assumes contents are PBF.
    if (buffer[0] === 0x78 && buffer[1] === 0x9c) {
      return {
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'deflate',
      }
    }

    // gzip: recklessly assumes contents are PBF.
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return {
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'gzip',
      }
    }

    throw new Error('Unsupported tile format')
  }

  /**
   * Retrieves a tile from the MBTiles file.
   *
   * The Y coordinate is automatically flipped from XYZ to TMS convention.
   *
   * @param z - Zoom level.
   * @param x - Tile column.
   * @param y - Tile row (XYZ convention, flipped internally to TMS).
   * @returns The tile data and HTTP-ready headers, or `null` if the tile does not exist.
   * @throws If the tile format is not recognised (not PNG, JPEG, GIF, WebP, or PBF).
   */
  getTile(z: number, x: number, y: number): GetTileResponse | null {
    // Flip Y coordinate because MBTiles files are TMS.
    // biome-ignore lint/suspicious/noBitwiseOperators: ok
    const newY = (1 << z) - 1 - y

    const res = this.getTileStmt.get(z, x, newY)

    if (!res?.tile_data || !Buffer.isBuffer(res.tile_data)) {
      return null
    }

    const headers = this.headers(res.tile_data)

    return {
      data: res.tile_data,
      headers: {
        ...headers,
        'Last-Modified': this.lastModified.toISOString(),
        ETag: `${this.size}-${this.lastModified.getTime()}`,
      },
    }
  }

  /**
   * Returns the metadata stored in the MBTiles `metadata` table.
   *
   * The `json` metadata key is parsed and merged at the top level.
   * `minzoom`/`maxzoom` are cast to integers; `center`/`bounds` to number arrays.
   *
   * @returns A metadata object, or `null` if the table is empty.
   */
  getInfos(): Info | null {
    const rows = this.getInfosStmt.all()

    if (!rows || rows.length === 0) {
      return null
    }

    return rows.reduce<Info>(
      (acc, row) => {
        switch (row.name) {
          // The special "json" key/value pair allows JSON to be serialized
          // and merged into the metadata of an MBTiles based source. This
          // enables nested properties and non-string datatypes to be
          // captured by the MBTiles metadata table.
          case 'json': {
            const jsondata = JSON.parse(row.value)
            Object.keys(jsondata).reduce((memo, key) => {
              acc[key] = acc[key] || jsondata[key]
              return memo
            }, acc)
            break
          }
          case 'minzoom':
          case 'maxzoom':
            acc[row.name] = parseInt(row.value, 10)
            break
          case 'center':
          case 'bounds':
            acc[row.name] = row.value.split(',').map(parseFloat)
            break
          default:
            acc[row.name] = row.value
            break
        }
        return acc
      },
      {
        scheme: 'xyz',
        minzoom: -0,
        maxzoom: -0,
        center: [],
        bounds: [],
      }
    )
  }
}
