import { Buffer } from 'std/io/buffer.ts'

export class SimpleBuffer extends Buffer {
  /**
   * read len bytes from buffer
   * @param len  number of bytes to read
   * @returns Uint8Array
   */
  readBytes(len: number): Uint8Array {
    if (this.length === 0) {
      throw new Error('Buffer is empty')
    }

    if (len > this.length) {
      throw new Error('Buffer is not enough')
    }

    const bytes = new Uint8Array(len)
    this.readSync(bytes)
    return bytes
  }

  /**
   * read one byte from buffer
   * @returns number [0, 255]
   */
  readByte(): number {
    if (this.length === 0) {
      throw new Error('Buffer is empty')
    }
    return this.readBytes(1)[0]
  }

  /**
   * has next byte
   * @returns boolean
   */
  hasNext(): boolean {
    return this.length > 0
  }
}
