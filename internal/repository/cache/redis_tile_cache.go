package cache

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisTileCache struct {
	client *redis.Client
}

func NewRedisTileCache(addr, password string, db, poolSize int) (*RedisTileCache, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
		PoolSize: poolSize,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &RedisTileCache{client: client}, nil
}

func (c *RedisTileCache) Get(ctx context.Context, key string) ([]byte, error) {
	return c.client.Get(ctx, key).Bytes()
}

func (c *RedisTileCache) Set(ctx context.Context, key string, data []byte, ttl time.Duration) error {
	return c.client.Set(ctx, key, data, ttl).Err()
}

func (c *RedisTileCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

func (c *RedisTileCache) InvalidateByBBox(
	ctx context.Context,
	layer string,
	minZ, maxZ int,
	minLon, minLat, maxLon, maxLat float64,
) error {
	for z := minZ; z <= maxZ; z++ {
		tiles := bboxToTiles(z, minLon, minLat, maxLon, maxLat)
		for _, t := range tiles {
			key := fmt.Sprintf("tile:%s:%d:%d:%d", layer, z, t.X, t.Y)
			c.client.Del(ctx, key)
		}
	}
	return nil
}

func (c *RedisTileCache) Close() error {
	return c.client.Close()
}

type TileCoord struct {
	X, Y int
}

func bboxToTiles(z int, minLon, minLat, maxLon, maxLat float64) []TileCoord {
	minX := lonToTile(minLon, z)
	maxX := lonToTile(maxLon, z)
	minY := latToTile(maxLat, z)
	maxY := latToTile(minLat, z)

	var tiles []TileCoord
	for x := minX; x <= maxX; x++ {
		for y := minY; y <= maxY; y++ {
			tiles = append(tiles, TileCoord{X: x, Y: y})
		}
	}
	return tiles
}

func lonToTile(lon float64, z int) int {
	n := 1 << uint(z)
	return int((lon + 180.0) / 360.0 * float64(n))
}

func latToTile(lat float64, z int) int {
	latRad := lat * 3.141592653589793 / 180.0
	n := 1 << uint(z)
	return int((1.0 - logTan(latRad)) / 2.0 * float64(n))
}

func logTan(latRad float64) float64 {
	return math.Log(math.Tan(latRad) + 1.0/math.Cos(latRad))
}

func TileCacheTTL(z int) time.Duration {
	switch {
	case z <= 6:
		return 24 * time.Hour
	case z <= 10:
		return 4 * time.Hour
	case z <= 14:
		return 1 * time.Hour
	default:
		return 15 * time.Minute
	}
}