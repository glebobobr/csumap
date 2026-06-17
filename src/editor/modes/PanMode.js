const PanMode = {
    onSetup: function() {
        this.map.dragPan.enable()
        this.map.doubleClickZoom.enable()
        this.map.touchZoomRotate.enable()
        return {}
    },

    onStop: function() {},

    toDisplayFeatures: function(state, geojson, display) {
        display(geojson)
    },

    clickAnywhere: function(state, e) {
        return true
    },

    clickOnFeature: function(state, e) {
        return true
    },

    onMouseDown: function(state, e) {
        return true
    },

    onMouseUp: function(state, e) {
        return true
    },

    onMouseMove: function(state, e) {
        return true
    },

    onDrag: function(state, e) {
        return true
    },

    onKeyUp: function(state, e) {
        return true
    },

    onKeyDown: function(state, e) {
        return true
    },

    onTrash: function() {
        return true
    },

    onCombineFeatures: function() {
        return true
    },

    onUncombineFeatures: function() {
        return true
    }
}

export default PanMode
