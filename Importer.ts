import PouchDB from 'pouchdb'
import axios from 'axios'

import { batchAsyncIterable } from './batchAsyncIterable'
import { Downloader, GTFSSource } from './Downloader'
import { ProgressUpdateCallback, ProgressUpdateImpl } from './Progress'
import GTFS from './GTFS'

import NodeDownloader from './NodeDownloader'

export type ImporterOptions = {
  database?: string | PouchDB.Database
  namespace?: string
  autoUpdate?: boolean
  downloader?: Downloader
  wipeExisting?: boolean
  batchSize?: number
}

export default  class GTFSLoader {
  // TODO: support multiple sources
  static async initialize (source: GTFSSource, options?: ImporterOptions, progress?: ProgressUpdateCallback): Promise<GTFS> {
    return new Importer(source, options || {}, progress).initialize()
  }
}

type DBMetadata = {
  lastUpdated: Date
  url: string
}

class Importer {
  private options: ImporterOptions
  private source: GTFSSource
  private downloader: Downloader
  private namespace: string
  private batchSize: number
  private progress: ProgressUpdateCallback | null
  private autoUpdate: boolean
  private database: PouchDB.Database

  constructor (source: GTFSSource, options: ImporterOptions, progress?: ProgressUpdateCallback) {
    this.source = source
    this.options = options
    // TODO: switch between browser and node implementations
    this.downloader = options.downloader || new NodeDownloader()
    this.namespace = options.namespace || 'gtfs'
    this.batchSize = options.batchSize || 100
    this.progress = progress || null
    this.autoUpdate = options.autoUpdate || false
    this.database = this.createDatabase(options)
  }

  async initialize (): Promise<GTFS> {
    const syncRequired = this.options.wipeExisting || (await this.isSyncRequired(this.source))
    if (syncRequired) {
      await this.wipeExisting()
      await this.sync(this.source)
    }
    return new GTFS(this.database, this.namespace)
  }

  private async isSyncRequired (source: GTFSSource): Promise<boolean> {
    try {
      const dbMeta: DBMetadata = await this.database.get(`_local/${this.namespace}/${source}`)
      if (this.autoUpdate) {
        // check if new version available
        const lastUpdated = await this.getLastUpdated(source)
        return lastUpdated > dbMeta.lastUpdated
      } else {
        return false
      }
    } catch (e) {
      if (e.name === 'not_found') {
        return true
      } else {
        throw e
      }
    }
  }

  private async wipeExisting (): Promise<void> {
    let startkey = this.namespace
    let i = 0
    while (true) {
      const res = await this.database.allDocs({
        startkey,
        endkey: this.namespace + '\ufff0',
        limit: this.batchSize + 1
      })
      if (res.total_rows == 0) return
      i += res.rows.length
      if (this.progress) {
        const progress = new ProgressUpdateImpl({
          stepName: `wipe ${startkey}`,
          stepNumber: 1,
          stepProgress: i,
          stepCount: 1, // TODO: not true
          stepTotal: res.total_rows
        })
        this.progress(progress)
      }
      console.log('wipe', startkey, i, res.total_rows, res.rows.length)
      startkey = res.rows[res.rows.length - 1].id
      await this.database.bulkDocs(res.rows.map(row => ({ ...row, _deleted: true })))
      if (res.rows.length === 1) break
    }
  }

  private async sync (source: GTFSSource): Promise<void> {
    const gtfsData = await this.downloader.getData(source)
    for await (const file of gtfsData.files) {
      const tableName = file.filename.replace(/\.txt$/, '')
      const primaryKeyColumns = this.getPrimaryKeys(tableName)
      const batchedRows = batchAsyncIterable(file.rows, this.batchSize)
      for await (const rows of batchedRows) {
        const data = rows.map(row => {
          const primaryKey = primaryKeyColumns.map(c => row.data[c]).join('/')
          return { _id: `${this.namespace}/${tableName}/${primaryKey}`, ...row.data }
        })
        await this.database.bulkDocs(data)
        if (this.progress) {
          const lastRow = rows[rows.length - 1]
          const progress = new ProgressUpdateImpl({
            stepName: tableName,
            stepNumber: file.fileNumber,
            stepCount: file.totalFiles,
            stepProgress: lastRow.bytesRead,
            stepTotal: lastRow.totalBytes
          })
          this.progress(progress)
        }
      }
    }
    const dbMeta: DBMetadata = {
      lastUpdated: gtfsData.lastUpdated,
      url: source.url
    }
    await this.database.put({ _id: `_local/${this.namespace}/${source.url}`, ...dbMeta })
  }

  private createDatabase (options: ImporterOptions): PouchDB.Database {
    if (typeof options.database === 'string') {
      return new PouchDB(options.database)
    } else if (options.database == undefined) {
      return new PouchDB('gtfs')
    } else {
      return options.database
    }
  }

  private async getLastUpdated (source: GTFSSource): Promise<Date> {
    const res = await axios.head(source.url)
    return new Date(res.headers['last-modified'])
  }

  private getPrimaryKeys (tableName: string): string[] {
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
}
