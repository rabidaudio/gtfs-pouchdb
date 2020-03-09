const isBrowser = typeof window !== 'undefined'
if (isBrowser) throw 'Unsupported'

import axios, { AxiosResponse } from  'axios'
import yazul, { ZipFile, Entry } from 'yauzl'
import csvParse from 'csv-parse'
import { Readable } from 'stream'

import { Downloader, GTFSSource, GTFSData, File, Row } from './Downloader'

type FileEntryResult = 'done' | 'directory' | Entry

function createAsyncIterable <T> (next: () => Promise<IteratorResult<T>>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: (() => ({ next }))
  }
}

function transformAsyncIterator <T, R> (src: AsyncIterator<T>, transform: ((value: T) => Promise<R>)): AsyncIterator<R> {
  return {
    next: async () => {
      const { done, value } = await src.next()
      const transformedValue = value == undefined ? value : (await transform(value))
      return { done, value: transformedValue }
    }
  }
}

function transformAsyncIterable <T, R> (src: AsyncIterable<T>, transform: ((value: T) => Promise<R>)): AsyncIterable<R> {
  return {
    [Symbol.asyncIterator]: (() => transformAsyncIterator(src[Symbol.asyncIterator](), transform))
  }
}

class NodeDownloader implements Downloader {
  async getData(source: GTFSSource): Promise<GTFSData> {
    const [lastUpdated, buffer] = await this.loadFromUrl(source)
    const zipfile = await this.openZipfile(buffer)
    const files = createAsyncIterable(() => this.readNextFile(zipfile))
    return { source, lastUpdated, files }
  }

  private async loadFromUrl (source: GTFSSource): Promise<[Date, Buffer]> {
    const res: AxiosResponse<ArrayBuffer> = await axios.get(source.url, { responseType: 'arraybuffer' })
    const lastModified = new Date(res.headers['last-modified'])
    return [lastModified, Buffer.from(res.data)]
  }

  private async readNextFile (zipfile: ZipFile): Promise<IteratorResult<File>> {
    const nextEntryResult = await this.readNextEntry(zipfile)
    if (nextEntryResult === 'done') {
      return { done: true, value: undefined }
    } else if (nextEntryResult === 'directory') {
      return this.readNextFile(zipfile)
    } else {
      const stream = await this.getReadStream(zipfile, nextEntryResult)
      const rows = transformAsyncIterable(this.getRowDataForFile(stream), async (data) => {
        const row: Row = {
          data,
          bytesRead: (stream as any).actualByteCount,
          totalBytes: (stream as any).expectedByteCount
        }
        return row
      })
      const file: File = {
        filename: nextEntryResult.fileName,
        fileNumber: zipfile.entriesRead,
        totalFiles: zipfile.entryCount,
        rows
      }
      return { done: false, value: file }
    }
  }

  private getRowDataForFile (stream: Readable): AsyncIterable<any> {
    return stream.pipe(csvParse({ columns: true, skip_empty_lines: true }))
  }

  private async openZipfile (buffer: Buffer): Promise<ZipFile> {
    return new Promise((resolve, reject) => {
      yazul.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err)
        resolve(zipfile)
      })
    })
  }

  private async readNextEntry (zipfile: ZipFile): Promise<FileEntryResult> {
    return new Promise((resolve) => {
      zipfile.readEntry()
      zipfile.once('end', () => resolve('done'))
      zipfile.once('entry', (entry) => {
        // check if directory
        if (/\/$/.test(entry.fileName)) return resolve('directory')
        resolve(entry)
      })
    })
  }

  private async getReadStream (zipfile: ZipFile, entry: Entry): Promise<Readable> {
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) return reject(err)
        resolve(readStream)
      })
    })
  }
}

export default NodeDownloader
