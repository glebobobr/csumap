import MapboxDraw from '@mapbox/mapbox-gl-draw'

const DrawLineMode = {}

DrawLineMode.onSetup = function() {
    const line = this.newFeature({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: []
        }
    })

    this.addFeature(line)
    this.clearSelectedFeatures()
    this.updateUIClasses({ mouse: 'add' })
    this.setActionableState({ trash: true })

    return {
        line,
        currentVertexPosition: 0,
        previewPosition: null
    }
}

DrawLineMode.onMouseMove = function(state, e) {
    if (state.line.coordinates.length === 0) return

    state.previewPosition = [e.lngLat.lng, e.lngLat.lat]
    state.line.setCoordinates(state.line.coordinates)
}

DrawLineMode.onClick = function(state, e) {
    state.line.coordinates.push([e.lngLat.lng, e.lngLat.lat])
    state.currentVertexPosition++
}

DrawLineMode.onKeyUp = function(state, e) {
    if (e.keyCode === 13) {
        return this.completeLine(state)
    }
    if (e.keyCode === 27) {
        this.deleteFeature([state.line.id], { silent: true })
        return this.changeMode('simple_select')
    }
}

DrawLineMode.onStop = function(state) {
    this.updateUIClasses({ mouse: 'none' })
    if (state.line.coordinates.length < 2) {
        this.deleteFeature([state.line.id], { silent: true })
    }
}

DrawLineMode.completeLine = function(state) {
    if (state.line.coordinates.length < 2) {
        return
    }

    this.map.fire('draw.create', {
        features: [state.line.toGeoJSON()]
    })

    return this.changeMode('simple_select', { featureIds: [state.line.id] })
}

DrawLineMode.toDisplayFeatures = function(state, geojson, display) {
    const isActiveLine = geojson.properties.id === state.line.id
    geojson.properties.active = isActiveLine ? 'true' : 'false'

    if (!isActiveLine || !state.previewPosition) {
        display(geojson)
        return
    }

    const coords = state.line.coordinates
    if (coords.length === 0) return

    const displayCoords = [...coords, state.previewPosition]

    display({
        type: 'Feature',
        properties: geojson.properties,
        geometry: {
            type: 'LineString',
            coordinates: displayCoords
        }
    })
}

DrawLineMode.onTrash = function(state) {
    this.deleteFeature([state.line.id], { silent: true })
    this.changeMode('simple_select')
}

export default DrawLineMode
