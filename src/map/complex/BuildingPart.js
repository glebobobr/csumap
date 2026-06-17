/**
 * @interface PartConfig
 * @property {string} id
 * @property {string} name
 * @property {'building'|'transition'} type
 * @property {number[][]} coordinates
 * @property {number} height
 * @property {number} [baseHeight]
 * @property {string} color
 * @property {string} [description]
 * @property {number} [levels]
 */

export class BuildingPart {
  #id
  #name
  #type
  #coordinates
  #height
  #baseHeight
  #color
  #description
  #levels

  /**
   * @param {PartConfig} config
   */
  constructor(config) {
    this.#validate(config)

    this.#id = config.id
    this.#name = config.name
    this.#type = config.type
    this.#coordinates = config.coordinates
    this.#height = config.height
    this.#baseHeight = config.baseHeight ?? 0
    this.#color = config.color
    this.#description = config.description ?? ''
    this.#levels = config.levels ?? 0
  }

  #validate(config) {
    if (!config.id || typeof config.id !== 'string') {
      throw new Error('BuildingPart: id is required')
    }
    if (!config.coordinates || !Array.isArray(config.coordinates)) {
      throw new Error('BuildingPart: coordinates are required')
    }
    if (typeof config.height !== 'number' || config.height <= 0) {
      throw new Error('BuildingPart: height must be a positive number')
    }
    if (!config.color) {
      throw new Error('BuildingPart: color is required')
    }
  }

  get id() { return this.#id }
  get name() { return this.#name }
  get type() { return this.#type }
  get height() { return this.#height }
  get baseHeight() { return this.#baseHeight }
  get color() { return this.#color }
  get description() { return this.#description }
  get levels() { return this.#levels }
  get coordinates() { return this.#coordinates }

  toFeature() {
    return {
      type: 'Feature',
      id: this.#id,
      properties: {
        id: this.#id,
        name: this.#name,
        type: this.#type,
        height: this.#height,
        base_height: this.#baseHeight,
        color: this.#color,
        description: this.#description,
        levels: this.#levels
      },
      geometry: {
        type: 'Polygon',
        coordinates: [this.#coordinates]
      }
    }
  }
}
