export default class GazeFilter {
  constructor(alpha = 0.25) {
    this.alpha = alpha
    this.prev = null
  }

  smooth(point) {
    if (!point) return null
    if (!this.prev) {
      this.prev = { x: point.x, y: point.y }
      return this.prev
    }

    const x = this.prev.x * (1 - this.alpha) + point.x * this.alpha
    const y = this.prev.y * (1 - this.alpha) + point.y * this.alpha
    this.prev = { x, y }
    return this.prev
  }

  reset() {
    this.prev = null
  }
}
