import { stat } from 'node:fs'

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

export class MBTilesReader {
  private db: Database.Database

  private lastModified?: Date

  private size?: number

  constructor(file: string, debug = false) {
    this.db = new Database(file, {
      // biome-ignore lint/suspicious/noConsole: fallback
      verbose: debug ? console.debug : undefined,
      readonly: true,
      fileMustExist: true,
    })

    stat(file, (err, infos) => {
      if (err) throw err

      this.lastModified = infos.mtime
      this.size = infos.size
    })
  }

  static checkFile(file: string): void {
    new MBTilesReader(file)
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
   * Retrieves a tile from the MBTiles file based on the provided zoom level (z), x, and y coordinates.
   *
   * @param z - The zoom level of the tile to retrieve.
   * @param x - The x coordinate of the tile to retrieve.
   * @param y - The y coordinate of the tile to retrieve.
   * @returns An object containing the tile data as a Buffer and the appropriate headers, or null if the tile is not found or is in an unsupported format.
   * @throws An error if the tile format is unsupported or if there is an issue with the database query.
   */
  getTile(z: number, x: number, y: number): GetTileResponse | null {
    // Flip Y coordinate because MBTiles files are TMS.
    // biome-ignore lint/suspicious/noBitwiseOperators: ok
    const newY = (1 << z) - 1 - y

    const sql =
      'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'

    const query = this.db.prepare<number[], { tile_data: Buffer }>(sql)

    const res = query.get(z, x, newY)

    if (!res?.tile_data || !Buffer.isBuffer(res.tile_data)) {
      return null
    }

    const headers = this.headers(res.tile_data)

    return {
      data: res.tile_data,
      headers: {
        ...headers,
        'Last-Modified': this.lastModified?.toISOString(),
        ETag: `${this.size}-${this.lastModified?.getTime()}`,
      },
    }
  }

  getInfos(): Info | null {
    const query = this.db.prepare<[], { name: string; value: string }>(
      'SELECT name, value FROM metadata'
    )

    const rows = query.all()

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
