import { BuildingPart } from './BuildingPart.js'

export class BuildingComplex {
  #id
  #name
  #parts

  /**
   * @param {string} id
   * @param {string} name
   * @param {BuildingPart[]} [initialParts]
   */
  constructor(id, name, initialParts = []) {
    this.#id = id
    this.#name = name
    this.#parts = []

    initialParts.forEach(p => this.add(p))
  }

  get id() { return this.#id }
  get name() { return this.#name }

  /**
   * @param {BuildingPart} part
   * @returns {BuildingComplex}
   */
  add(part) {
    if (!(part instanceof BuildingPart)) {
      throw new Error('Only BuildingPart instances can be added')
    }
    if (this.#parts.some(p => p.id === part.id)) {
      throw new Error(`Part with id "${part.id}" already exists`)
    }
    this.#parts.push(part)
    return this
  }

  /**
   * @param {string} id
   * @returns {BuildingComplex}
   */
  remove(id) {
    this.#parts = this.#parts.filter(p => p.id !== id)
    return this
  }

  /**
   * @returns {BuildingPart[]}
   */
  getAll() {
    return [...this.#parts]
  }

  /**
   * @param {string} id
   * @returns {BuildingPart|undefined}
   */
  get(id) {
    return this.#parts.find(p => p.id === id)
  }

  /**
   * @returns {number}
   */
  get partsCount() {
    return this.#parts.length
  }

  toFeatureCollection() {
    return {
      type: 'FeatureCollection',
      features: this.#parts.map(p => p.toFeature())
    }
  }
}
