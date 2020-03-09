export type GTFSSource = {
  url: string
}

export interface GTFSData {
  source: GTFSSource
  lastUpdated: Date
  files: AsyncIterable<File>
}

export type File = {
  filename: string
  fileNumber: number
  totalFiles: number
  rows: AsyncIterable<Row>
}

export type Row = {
  data: any
  bytesRead: number
  totalBytes: number
}

export interface Downloader {
  getData(source: GTFSSource): Promise<GTFSData>
}
