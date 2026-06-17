package domain

type TileCoord struct {
	Z int
	X int
	Y int
}

func (t TileCoord) Key() string {
	return string(rune(t.Z)) + "/" + string(rune(t.X)) + "/" + string(rune(t.Y))
}

type TileJSON struct {
	TileJSON   string   `json:"tilejson"`
	Name       string   `json:"name"`
	Tiles      []string `json:"tiles"`
	MinZoom    int      `json:"minzoom"`
	MaxZoom    int      `json:"maxzoom"`
	Bounds     []float64 `json:"bounds,omitempty"`
	Center     []float64 `json:"center,omitempty"`
	Attribution string  `json:"attribution,omitempty"`
	Version    string   `json:"version,omitempty"`
}