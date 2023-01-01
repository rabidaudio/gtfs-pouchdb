import GTFS from 'gtfs-sequelize'
import { Database } from 'spatiasql'


const db = new Database()



var gtfs = GTFS({})
gtfs.loadGtfs(function() {
  //database loading has finished callback
});
