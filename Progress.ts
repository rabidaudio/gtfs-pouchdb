export interface ProgressUpdate {
  stepName: string
  stepNumber: number
  stepCount: number
  stepPercent: number
  stepProgress: number
  stepTotal: number
  totalPercent: number
}

export type ProgressUpdateCallback = (progress: ProgressUpdate) => void

export class ProgressUpdateImpl implements ProgressUpdate {
  readonly stepName: string
  readonly stepNumber: number
  readonly stepCount: number
  readonly stepProgress: number
  readonly stepTotal: number
  constructor (args: { stepName: string, stepNumber: number, stepCount: number, stepProgress: number, stepTotal: number }) {
    this.stepName = args.stepName
    this.stepNumber = args.stepNumber
    this.stepCount = args.stepCount
    this.stepProgress = args.stepProgress
    this.stepTotal = args.stepTotal
  }
  get stepPercent () {
    return this.stepProgress / this.stepTotal
  }

  get totalPercent () {
    return (this.stepNumber + this.stepPercent) / this.stepCount
  }
}
