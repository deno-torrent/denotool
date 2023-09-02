import { BufReader } from 'std/io/buf_reader.ts'
import { Buffer } from 'std/io/buffer.ts'
import { Reader } from 'std/types.d.ts'

/**
 * MultiFileReader read multiple files as one file
 */
export default class MultiFileReader implements Reader {
  readonly #buf: Buffer = new Buffer()
  readonly #rd = new BufReader(this.#buf)
  readonly #files: string[]
  readonly #rdMap: Map<string, Deno.FsFile> = new Map()
  #curFile // 当前读取的文件
  #eof = false // 是否读取到最后一个文件的末尾

  constructor(files: string[]) {
    // 初始化的时候,不创建文件读取器,只创建文件路径的映射
    this.#files = [...files]
    this.#curFile = this.#files[0]
  }

  /**
   * 是否有下一个文件
   * @returns boolean true:有下一个文件,false:没有下一个文件
   */
  private hasNextFile() {
    const index = this.#files.indexOf(this.#curFile)
    const lastIndex = this.#files.length - 1
    return index < lastIndex
  }

  /**
   * 如果有三个文件,大小分别是13,1,1,p的长度是20,则每次读取的大小分别是13,1,1,null
   * @param p 用来存储读取数据的字节数组
   * @returns 读取的长度
   */
  public async read(p: Uint8Array): Promise<number | null> {
    if (this.#eof) return null

    let reader = this.#rdMap.get(this.#curFile)
    if (!reader) {
      // 如果文件读取器不存在,则创建文件读取器
      reader = await Deno.open(this.#curFile, { read: true })
      // 并且将文件读取器缓存到 readerMap 中
      this.#rdMap.set(this.#curFile, reader)
    }

    const result = await reader.read(p)

    // null 表示当前文件读取完毕
    if (result === null) {
      // 关闭当前文件读取器
      reader.close()
      this.#rdMap.delete(this.#curFile)

      // 已经是最后一个文件, 返回null,表示所有文件读取完毕
      if (!this.hasNextFile()) {
        this.#eof = true
        return null
      } else {
        // 不是最后一个文件,移动到下一个文件
        this.#curFile = this.#files[this.#files.indexOf(this.#curFile) + 1]

        // 递归调用 read 函数,读取下一个文件
        return this.read(p)
      }
    }
    return result
  }

  /**
   * 读取指定长度的字节,不同于上面的read,这个函数不会将文件分割成多个块,而是将多个文件视为一个整体,读取指定长度的字节
   * 如果有三个文件,大小分别是13,1,1,指定读取长度是20,则每次读取的大小分别是15,null
   *
   * @param length 读取的长度
   * @returns 读取到的字节数组,如果读取完毕,则返回null
   */
  public async readChunk(length: number): Promise<Uint8Array | null> {
    while (true) {
      const tempChunk = new Uint8Array(length)
      const result = await this.read(tempChunk)

      // 已经读取完毕
      if (result === null) {
        // 如果还有缓存,则返回缓存中的字节
        if (!this.#buf.empty()) {
          return await this.#rd.readFull(new Uint8Array(this.#buf.length))
        } else {
          return null
        }
      }

      // 将读取到的字节写入缓存
      await this.#buf.write(tempChunk.subarray(0, result))

      // 如果buffer字节超过或者 length,回调 buffers 中的前 length 字节
      // 循环回调,直到 buffer 字节小于 length
      if (this.#buf.length >= length) {
        return await this.#rd.readFull(new Uint8Array(length))
      }
    }
  }

  /**
   * 重置读取器,将读取器重置到初始状态
   */
  public reset(): void {
    this.#buf.reset()
    this.#curFile = this.#files[0]
    this.#eof = false
  }
}
