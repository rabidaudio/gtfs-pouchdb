import PouchDB from 'pouchdb'
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory'

import GTFSLoader from './Importer'

const GTFS_DATA_URL = 'https://www.itsmarta.com/google_transit_feed/google_transit.zip'

PouchDB.plugin(PouchDBMemoryAdapter)

const db = new PouchDB('gtfs', { adapter: 'memory' })

GTFSLoader.initialize({ url: GTFS_DATA_URL }, {
  autoUpdate: true, wipeExisting: true,
  database: db
}, (progress) => {
  console.log(progress.stepName, progress.stepPercent)
  // console.log((Math.round(progress.totalPercent * 100 * 100) / 100).toString() + '%')
}).then(console.log.bind(console)).catch(console.error.bind(console))
