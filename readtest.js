const yazul = require('yauzl')
const PouchDB = require('pouchdb')
const csvParse = require('csv-parse')
const axios = require('axios')
const batch = require('batch-async-iterator')


const GTFS_DATA_URL = 'https://www.itsmarta.com/google_transit_feed/google_transit.zip'

async function getLastUpdated () {
  const res = await axios.head(GTFS_DATA_URL)
  return res.headers['Last-Modified']
}

async function loadFromUrl () {
  const res = await axios.get(GTFS_DATA_URL)
  const lastModified = res.headers['Last-Modified']
}

//// Can use Last-Modified header!
// < HTTP/1.1 200 OK
// < Cache-Control: public
// < Content-Length: 12581214
// < Content-Type: application/zip
// < Last-Modified: Fri, 06 Dec 2019 15:19:59 GMT
// < Accept-Ranges: bytes
// < Server: Microsoft-IIS/8.5
// < X-AspNet-Version: 4.0.30319
// < X-Powered-By: ASP.NET
// < X-Frame-Options: SAMEORIGIN
// < Date: Mon, 09 Mar 2020 00:52:48 GMT

async function readNextEntry (zipfile) {
  return new Promise((resolve, reject) => {
    zipfile.readEntry()
    zipfile.once('end', () => resolve('done'))
    zipfile.once('entry', (entry) => {
      // check if directory
      if (/\/$/.test(entry.fileName)) return resolve('directory')
      zipfile.openReadStream(entry, function(err, readStream) {
        if (err) return reject(err)
        resolve({filename: entry.fileName, stream: readStream })
      })
    })
  })
}

async function openZipfile (path) {
  return new Promise((resolve, reject) => {
    yazul.open(path, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err)
      resolve(zipfile)
    })
  })
}

function getPrimaryKeys (tableName) {
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

const BATCH_SIZE = 100

const PREFIX = 'marta/gtfs'

async function populate (lastModified, progress) {
  let db = new PouchDB('marta-gtfs')
  const info = await db.info()
  if (info.doc_count > 0) {
    await db.destroy()
    db = new PouchDB('marta-gtfs') 
  }
  await db.put({ _id: `_local/${PREFIX}/lastModified`, lastModified })
  // yazul.fromBuffer
  const start = new Date().getTime()
  const zipfile = await openZipfile('./data/google_transit.zip')
  while (true) {
    const nextEntry = await readNextEntry(zipfile)
    if (nextEntry === 'directory') continue
    if (nextEntry === 'done') break
    const tableName = nextEntry.filename.replace(/\.txt$/, '')
    console.log(tableName)
    const parser = nextEntry.stream.pipe(csvParse({ columns: true, skip_empty_lines: true }))
    const batchedRows = batch(parser, BATCH_SIZE)
    for await (const rows of batchedRows) {
      const data = rows.map(row => {
        const primaryKeyColumns = getPrimaryKeys(tableName)
        const primaryKey = primaryKeyColumns.map(c => row[c]).join('/')

        return {
          _id: `${PREFIX}/${tableName}/${primaryKey}`,
          ...row
        }
        // await db.put(data)
      })
      await db.bulkDocs(data)
      if (progress) {
        progress({
          stepName: tableName,
          step: zipfile.entriesRead,
          totalSteps: zipfile.entryCount,
          stepProgress: nextEntry.stream.actualByteCount,
          stepTotal: nextEntry.stream.expectedByteCount,
          stepPercent: nextEntry.stream.actualByteCount / nextEntry.stream.expectedByteCount,
          totalPercent: (zipfile.entriesRead + (nextEntry.stream.actualByteCount / nextEntry.stream.expectedByteCount)) / zipfile.entryCount
        })
      }
    }
  }
  const end = new Date().getTime()
  console.log('insert time', BATCH_SIZE, end - start)
  return db
}

class StaticData {
  constructor(db) {
    this.db = db
    this.prefix = PREFIX
  }

  async getAgencyInfo () {
    return this.db.get(`${this.prefix}/agency/MARTA`)
  }
}

populate(new Date()).then(console.log.bind(console)).catch(console.log.bind(console))
