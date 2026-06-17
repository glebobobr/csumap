import MapboxDraw from '@mapbox/mapbox-gl-draw'

const builtin = MapboxDraw.modes.direct_select
const DirectSelectMode = { ...builtin }

// ─── Box select helpers ───

DirectSelectMode.clearBoxSelect = function(state) {
  if (state.boxSelectElement) {
    if (state.boxSelectElement.parentNode) {
      state.boxSelectElement.parentNode.removeChild(state.boxSelectElement)
    }
    state.boxSelectElement = null
  }
  state.boxSelecting = false
  state.canBoxSelect = false
  state.boxSelectStartLocation = null
}

DirectSelectMode.startBoxSelect = function(state, e) {
  this.stopDragging(state)
  this.map.dragPan.disable()
  state.boxSelectStartLocation = { x: e.point.x, y: e.point.y }
  state.canBoxSelect = true
}

DirectSelectMode.whileBoxSelect = function(state, e) {
  state.boxSelecting = true
  this.updateUIClasses({ mouse: 'add' })

  if (!state.boxSelectElement) {
    state.boxSelectElement = document.createElement('div')
    state.boxSelectElement.classList.add('mapbox-gl-draw_boxselect')
    this.map.getContainer().appendChild(state.boxSelectElement)
  }

  const current = { x: e.point.x, y: e.point.y }
  const minX = Math.min(state.boxSelectStartLocation.x, current.x)
  const maxX = Math.max(state.boxSelectStartLocation.x, current.x)
  const minY = Math.min(state.boxSelectStartLocation.y, current.y)
  const maxY = Math.max(state.boxSelectStartLocation.y, current.y)
  state.boxSelectElement.style.transform = `translate(${minX}px, ${minY}px)`
  state.boxSelectElement.style.width = `${maxX - minX}px`
  state.boxSelectElement.style.height = `${maxY - minY}px`
}

DirectSelectMode.endBoxSelect = function(state, e) {
  if (state.boxSelecting) {
    const current = { x: e.point.x, y: e.point.y }
    const bbox = [[
      Math.min(state.boxSelectStartLocation.x, current.x),
      Math.min(state.boxSelectStartLocation.y, current.y)
    ], [
      Math.max(state.boxSelectStartLocation.x, current.x),
      Math.max(state.boxSelectStartLocation.y, current.y)
    ]]

    const features = this.map.queryRenderedFeatures(bbox)
    const vertexPaths = features
      .filter(f => f.properties.meta === 'vertex' && f.properties.parent === state.featureId)
      .map(f => f.properties.coord_path)

    if (vertexPaths.length > 0) {
      const existing = new Set(state.selectedCoordPaths)
      vertexPaths.forEach(path => existing.add(path))
      state.selectedCoordPaths = Array.from(existing)

      this.setSelectedCoordinates(
        this.pathsToCoordinates(state.featureId, state.selectedCoordPaths)
      )
      state.feature.changed()
    }
  }
  this.clearBoxSelect(state)
}

// ─── Overrides ───

DirectSelectMode.onSetup = function(opts) {
  const state = builtin.onSetup.call(this, opts)
  state.boxSelectStartLocation = null
  state.boxSelectElement = undefined
  state.boxSelecting = false
  state.canBoxSelect = false
  return state
}

DirectSelectMode.onStop = function(state) {
  this.clearBoxSelect(state)
  builtin.onStop.call(this)
}

DirectSelectMode.stopDragging = function(state) {
  if (state.canDragMove && state.initialDragPanState === true) {
    this.map.dragPan.enable()
  }
  state.initialDragPanState = null
  state.dragMoving = false
  state.canDragMove = false
  state.dragMoveLocation = null
  this.clearBoxSelect(state)
}

DirectSelectMode.onMouseDown = function(state, e) {
  const ft = e.featureTarget
  const meta = ft?.properties?.meta
  const active = ft?.properties?.active

  if (meta === 'vertex') return this.onVertex(state, e)
  if (active === 'true' && meta === 'feature') return this.onFeature(state, e)
  if (meta === 'midpoint') return this.onMidpoint(state, e)

  if (e.originalEvent.shiftKey && e.originalEvent.button === 0) {
    return this.startBoxSelect(state, e)
  }
}

DirectSelectMode.onDrag = function(state, e) {
  if (state.canDragMove) {
    state.dragMoving = true
    e.originalEvent.stopPropagation()

    const delta = {
      lng: e.lngLat.lng - state.dragMoveLocation.lng,
      lat: e.lngLat.lat - state.dragMoveLocation.lat
    }

    if (state.selectedCoordPaths.length > 0) this.dragVertex(state, e, delta)
    else this.dragFeature(state, e, delta)

    state.dragMoveLocation = e.lngLat
    return
  }

  if (state.canBoxSelect) return this.whileBoxSelect(state, e)
}

DirectSelectMode.onMouseUp = DirectSelectMode.onTouchEnd = function(state, e) {
  if (state.dragMoving) {
    this.fireUpdate()
  } else if (state.boxSelecting) {
    this.endBoxSelect(state, e)
  }
  this.stopDragging(state)
}

DirectSelectMode.onMouseMove = function(state, e) {
  if (state.canBoxSelect) {
    this.updateUIClasses({ mouse: 'add' })
    this.stopDragging(state)
    return true
  }
  return builtin.onMouseMove.call(this, state, e)
}

DirectSelectMode.onMouseOut = function(state) {
  if (state.dragMoving) this.fireUpdate()
  this.clearBoxSelect(state)
  return true
}

DirectSelectMode.onVertex = function(state, e) {
  this.startDragging(state, e)

  const about = e.featureTarget.properties
  const selectedIndex = state.selectedCoordPaths.indexOf(about.coord_path)
  const isShift = e.originalEvent.shiftKey
  const isCtrl = e.originalEvent.ctrlKey || e.originalEvent.metaKey
  const isAdditive = isShift || isCtrl

  if (!isAdditive && selectedIndex === -1) {
    state.selectedCoordPaths = [about.coord_path]
  } else if (isAdditive && selectedIndex === -1) {
    state.selectedCoordPaths.push(about.coord_path)
  } else if (isAdditive && selectedIndex !== -1) {
    state.selectedCoordPaths.splice(selectedIndex, 1)
  }

  this.setSelectedCoordinates(
    this.pathsToCoordinates(state.featureId, state.selectedCoordPaths)
  )
}

DirectSelectMode.clickNoTarget = function(state) {
  this.clearSelectedCoordinates()
  state.selectedCoordPaths = []
  state.feature.changed()
}

DirectSelectMode.clickInactive = function() {
  this.changeMode('simple_select')
}

DirectSelectMode.clickActiveFeature = function(state) {
  state.selectedCoordPaths = []
  this.clearSelectedCoordinates()
  state.feature.changed()
}

DirectSelectMode.onKeyUp = function(state, e) {
  if (e.keyCode === 27) {
    if (state.selectedCoordPaths.length > 0) {
      this.clearSelectedCoordinates()
      state.selectedCoordPaths = []
      state.feature.changed()
    } else {
      this.changeMode('simple_select')
    }
  }
}

export default DirectSelectMode
