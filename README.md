NOTE: work-in-progress

Goals:

- Async load static GTFS data from urls
- Provide helper methods for most common queries, as well as raw access to data
- Support both node and browser
- Support multiple agencies in the same database
- Support sharing the database with other data, exposing user configuration of the database
- Expose data in useful data structures (GeoJSON?)
- Support both the latest patterns and build tools (e.g. Typescript, Promises, ES2016+) as well as faster, easier interfaces
  for beginner devs and small projects (globals, callbacks, ES5)

1. PouchDB is popular db that supports both node and browser
    - It's document rather than relational. However there are relational plugins
    - Will require consideration of schema and indexing to map to document store
2. Async load data from multiple gtfs sources, provide progress callback so UI can show progress
  - importing takes a  while: Marta data takes over a minute on node, with 100-row batches
3. Support checking for updates and auto-updates, but don't require it
4. Unzipping and parsing CSV seems to be very difficult to do cross-platform
  - node has streams, better unzip and CSV libs
  - browser uses File/Blob
  - perhaps need way to swap implementations?
5. Option to seed database from file for faster setup?
6. Build an example browser project for proving usability

https://developers.google.com/transit/gtfs/reference
https://en.wikipedia.org/wiki/GeoJSON

https://github.com/pouchdb-community/relational-pouch
https://github.com/pouchdb/geopouch

https://www.npmjs.com/package/gtfs
https://www.npmjs.com/package/gtfs-realtime-bindings-transit
https://github.com/blinktaginc/gtfs-to-geojson


```
Filename 	Required 	Defines
agency.txt 	Required 	Transit agencies with service represented in this dataset.
stops.txt 	Required 	Stops where vehicles pick up or drop off riders. Also defines stations and station entrances.
routes.txt 	Required 	Transit routes. A route is a group of trips that are displayed to riders as a single service.
trips.txt 	Required 	Trips for each route. A trip is a sequence of two or more stops that occur during a specific time period.
stop_times.txt 	Required 	Times that a vehicle arrives at and departs from stops for each trip.
calendar.txt 	Conditionally required 	Service dates specified using a weekly schedule with start and end dates. This file is required unless all dates of service are defined in calendar_dates.txt.
calendar_dates.txt 	Conditionally required 	Exceptions for the services defined in the calendar.txt. If calendar.txt is omitted, then calendar_dates.txt is required and must contain all dates of service.
fare_attributes.txt 	Optional 	Fare information for a transit agency's routes.
fare_rules.txt 	Optional 	Rules to apply fares for itineraries.
shapes.txt 	Optional 	Rules for mapping vehicle travel paths, sometimes referred to as route alignments.
frequencies.txt 	Optional 	Headway (time between trips) for headway-based service or a compressed representation of fixed-schedule service.
transfers.txt 	Optional 	Rules for making connections at transfer points between routes.
pathways.txt 	Optional 	Pathways linking together locations within stations.
levels.txt 	Optional 	Levels within stations.
feed_info.txt 	Optional 	Dataset metadata, including publisher, version, and expiration information.
translations.txt 	Optional 	Translated information of a transit agency.
attributions.txt 	Optional 	Specifies the attributions that are applied to the dataset.
```
