import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MBTilesReader } from '../src/index'

const tempDirectories: string[] = []

function createDatabase(): { file: string; db: Database.Database } {
  const directory = mkdtempSync(join(tmpdir(), 'mbtiles-reader-'))
  tempDirectories.push(directory)
  const file = join(directory, 'tiles.mbtiles')
  const db = new Database(file)

  db.exec(`
    CREATE TABLE metadata (name TEXT, value TEXT);
    CREATE TABLE tiles (
      zoom_level INTEGER,
      tile_column INTEGER,
      tile_row INTEGER,
      tile_data BLOB
    );
  `)

  return { file, db }
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('MBTilesReader', () => {
  it('returns tiles using XYZ coordinates and detects their formats', () => {
    const { db, file } = createDatabase()
    const tiles = [
      { data: Buffer.from([0x1f, 0x8b]), type: 'application/x-protobuf', encoding: 'gzip' },
      { data: Buffer.from([0x78, 0x9c]), type: 'application/x-protobuf', encoding: 'deflate' },
      { data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), type: 'image/png' },
      { data: Buffer.from([0xff, 0xd8, 0x00, 0xff, 0xd9]), type: 'image/jpeg' },
      { data: Buffer.from('GIF89a'), type: 'image/gif' },
      { data: Buffer.from('GIF87a'), type: 'image/gif' },
      {
        data: Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
        type: 'image/webp',
      },
    ]
    const insert = db.prepare(
      'INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)'
    )

    for (const [column, tile] of tiles.entries()) {
      insert.run(2, column, 3, tile.data)
    }
    db.close()

    const reader = new MBTilesReader(file)
    for (const [column, tile] of tiles.entries()) {
      expect(reader.getTile(2, column, 0)).toMatchObject({
        data: tile.data,
        headers: {
          'Content-Type': tile.type,
          ...(tile.encoding ? { 'Content-Encoding': tile.encoding } : {}),
        },
      })
    }
    expect(reader.getTile(2, 0, 0)?.headers).toMatchObject({
      'Last-Modified': expect.any(String),
      ETag: expect.stringMatching(/^[0-9a-z]+-[0-9a-z]+$/),
    })
    expect(reader.getTile(2, 99, 0)).toBeNull()
    reader.close()
  })

  it('enables SQLite debug logging when requested', () => {
    const { db, file } = createDatabase()
    db.close()
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    const reader = new MBTilesReader(file, true)
    reader.close()

    expect(debug).toHaveBeenCalled()
    debug.mockRestore()
  })

  it('rejects unsupported tile data', () => {
    const { db, file } = createDatabase()
    db.prepare('INSERT INTO tiles VALUES (?, ?, ?, ?)').run(0, 0, 0, Buffer.from('unknown'))
    db.close()

    const reader = new MBTilesReader(file)
    expect(() => reader.getTile(0, 0, 0)).toThrow('Unsupported tile format')
    reader.close()
  })

  it('reads, casts, and merges metadata', () => {
    const { db, file } = createDatabase()
    const insert = db.prepare('INSERT INTO metadata VALUES (?, ?)')
    insert.run('name', 'Example tiles')
    insert.run('minzoom', '2')
    insert.run('maxzoom', '14')
    insert.run('center', '1.5,2.5,3')
    insert.run('bounds', '-1,-2,3,4')
    insert.run(
      'json',
      JSON.stringify({ attribution: 'Open data', nested: { enabled: true }, name: 'JSON name' })
    )
    db.close()

    const reader = new MBTilesReader(file)
    expect(reader.getInfos()).toEqual({
      scheme: 'xyz',
      minzoom: 2,
      maxzoom: 14,
      center: [1.5, 2.5, 3],
      bounds: [-1, -2, 3, 4],
      name: 'Example tiles',
      attribution: 'Open data',
      nested: { enabled: true },
    })
    reader.close()
  })

  it('returns null for empty metadata and validates files', () => {
    const { db, file } = createDatabase()
    db.close()

    const reader = new MBTilesReader(file)
    expect(reader.getInfos()).toBeNull()
    reader.close()

    expect(() => MBTilesReader.checkFile(file)).not.toThrow()
    expect(() => MBTilesReader.checkFile(join(tmpdir(), 'missing.mbtiles'))).toThrow()
  })
})
