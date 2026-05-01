import { open, stat } from 'node:fs/promises'

export class LocalPmtilesSource {
  constructor(filePath) {
    this.filePath = filePath
    this.key = `file://${filePath}`
    this.handle = null
    this.etag = null
    this._ready = this._init(filePath)
  }

  async _init(filePath) {
    const [handle, fileStats] = await Promise.all([open(filePath, 'r'), stat(filePath)])
    this.handle = handle
    this.etag = `${fileStats.size}-${fileStats.mtimeMs}`
  }

  getKey() {
    return this.key
  }

  async getBytes(offset, length, signal) {
    signal?.throwIfAborted?.()

    await this._ready

    const buffer = Buffer.allocUnsafe(length)
    const { bytesRead } = await this.handle.read(buffer, 0, length, offset)

    signal?.throwIfAborted?.()

    const view = buffer.subarray(0, bytesRead)

    return {
      data: view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
      etag: this.etag,
    }
  }

  async close() {
    await this._ready
    await this.handle.close()
  }
}
