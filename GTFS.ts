import PouchDB from 'pouchdb'

class GTFS {
  readonly database: PouchDB.Database
  readonly namespace: string
  constructor (database: PouchDB.Database, namespace: string) {
    this.database = database
    this.namespace = namespace
  }
}
export default GTFS
