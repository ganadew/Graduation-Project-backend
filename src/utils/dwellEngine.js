export default class DwellEngine {
  constructor(thresholdMs = 1500) {
    this.thresholdMs = thresholdMs
    this.currentId = null
    this.startTime = null
  }

  /**
   * @returns {{ done: boolean, progress: number }}
   * progress: 0~1
   */
  update(id) {
    const now = Date.now()

    if (this.currentId !== id) {
      this.currentId = id
      this.startTime = now
      return { done: false, progress: 0 }
    }

    const elapsed = now - (this.startTime ?? now)
    const progress = Math.min(1, elapsed / this.thresholdMs)
    return { done: elapsed >= this.thresholdMs, progress }
  }

  reset() {
    this.currentId = null
    this.startTime = null
  }
}
