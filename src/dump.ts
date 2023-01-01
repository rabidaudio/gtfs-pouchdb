import { Readable, Transform } from 'stream'
import axios from  'axios'
import yauzl, { Entry, ZipFile } from 'yauzl-promise'
import csvParse, { Parser } from 'csv-parse'
import PouchDB from 'pouchdb'


class BatchingTransform extends Transform {
  private buffer: any = []
  constructor (readonly batchSize: number) {
    super({ objectMode: true })
  }

  _transform (chunk: any | null, encoding: string, callback: (err?: Error) => void) {
    if (chunk == null) {
      this.flush()
    } else {
      this.buffer.push(chunk)
      if (this.buffer.length >= this.batchSize) this.flush()
    }
    callback()
  }

  private flush () {
    this.push(this.buffer)
    this.buffer = []
  }
}

async function forEachInStream (stream: Readable, callback: (chunk: any) => Promise<void>): Promise<void> {
  const promises: Promise<any>[] = []
  stream.on('data', chunk => promises.push(callback(chunk)))
  await new Promise(resolve => stream.on('end', () => resolve()))
  await Promise.all(promises)
}

function getPrimaryKeys (tableName: string): string[] {
  switch (tableName) {
    case 'agency': return ['agency_id']
    case 'calendar_dates': return ['service_id', 'date']
    case 'calendar': return ['service_id']
    case 'routes': return ['route_id']
    case 'shapes': return ['shape_id', 'shape_pt_sequence']
    case 'stop_times': return ['trip_id', 'stop_sequence']
    case 'stops': return ['stop_id']
    case 'trips': return ['trip_id']
    default: throw new Error(`Unknown GTFS table: ${tableName}`)
  }
}

const GTFS_DATA_URL = 'https://www.itsmarta.com/google_transit_feed/google_transit.zip'
const db = new PouchDB('data/gtfs') // { adapter: 'memory' }
const namespace = 'gtfs'

type ProgressCallback = (percentage: number, currentFile: string) => void


async function loadFile (zipFile: ZipFile, entry: Entry, bytesReadSoFar: number, bytesTotal: number, progress: ProgressCallback): Promise<void> {
  const fileStream = await zipFile.openReadStream(entry)
  const rowStream = fileStream
    .pipe(csvParse({ columns: true, skip_empty_lines: true }))
    .pipe(new BatchingTransform(100))
  await forEachInStream(rowStream, async (rows: any[]) => {
    const tableName = entry.fileName.replace(/\.txt$/, '')
    const primaryKeyColumns = getPrimaryKeys(tableName)
    const data = rows.map(row => {
      const primaryKey = primaryKeyColumns.map(c => row[c]).join('/')
      return { _id: `${namespace}/${tableName}/${primaryKey}`, ...row }
    })
    await db.bulkDocs(data)
    // TODO: this doesn't work well because the file has already streamed into memory
    const readThisFile = (fileStream as any).actualByteCount
    progress((bytesReadSoFar + readThisFile) / bytesTotal, entry.fileName)
  })
}


async function load (progress: ProgressCallback): Promise<void> {
  const res = await axios.get<ArrayBuffer>(GTFS_DATA_URL, { responseType: 'arraybuffer' })
  const zipData = Buffer.from(res.data)
  const zipFile = await yauzl.fromBuffer(zipData, { lazyEntries: true })
  const entries = (await zipFile.readEntries()).filter(e => !/\/$/.test(e.fileName))
  const totalBytes = entries.map(e => e.uncompressedSize).reduce((a, b) => a + b, 0)
  let readBytes = 0
  for (const entry of entries) {
    await loadFile(zipFile, entry, readBytes, totalBytes, progress)
    readBytes += entry.uncompressedSize
  }  
}

load((p, f) => console.log(f, p)).then(console.log.bind(console)).catch(console.error.bind(console))

// if (window) (window as any).db = db

