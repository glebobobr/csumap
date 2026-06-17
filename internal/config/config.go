package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	Log      LogConfig
}

type ServerConfig struct {
	Address         string        `mapstructure:"address"`
	ReadTimeout     time.Duration `mapstructure:"read_timeout"`
	WriteTimeout    time.Duration `mapstructure:"write_timeout"`
	IdleTimeout     time.Duration `mapstructure:"idle_timeout"`
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout"`
}

type DatabaseConfig struct {
	DSN             string        `mapstructure:"dsn"`
	MaxConns        int32         `mapstructure:"max_conns"`
	MinConns        int32         `mapstructure:"min_conns"`
	MaxConnLifetime time.Duration `mapstructure:"max_conn_lifetime"`
	MaxConnIdleTime time.Duration `mapstructure:"max_conn_idle_time"`
}

type RedisConfig struct {
	Address  string `mapstructure:"address"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

type JWTConfig struct {
	Secret          string        `mapstructure:"secret"`
	AccessTokenTTL  time.Duration `mapstructure:"access_token_ttl"`
}

type LogConfig struct {
	Level       string `mapstructure:"level"`
	Development bool   `mapstructure:"development"`
}

func Load() *Config {
	v := viper.New()

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")
	v.AddConfigPath("/etc/csumap")

	v.SetEnvPrefix("CSUMAP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	setDefaults(v)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			panic("failed to read config: " + err.Error())
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		panic("failed to unmarshal config: " + err.Error())
	}

	return &cfg
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("server.address", ":8080")
	v.SetDefault("server.read_timeout", "15s")
	v.SetDefault("server.write_timeout", "30s")
	v.SetDefault("server.idle_timeout", "60s")
	v.SetDefault("server.shutdown_timeout", "10s")

	v.SetDefault("database.dsn", "postgres://postgres:postgres@localhost:5432/csumap")
	v.SetDefault("database.max_conns", 25)
	v.SetDefault("database.min_conns", 5)
	v.SetDefault("database.max_conn_lifetime", "1h")
	v.SetDefault("database.max_conn_idle_time", "30m")

	v.SetDefault("redis.address", "localhost:6379")
	v.SetDefault("redis.password", "")
	v.SetDefault("redis.db", 0)
	v.SetDefault("redis.pool_size", 10)

	v.SetDefault("jwt.secret", "change-me-in-production")
	v.SetDefault("jwt.access_token_ttl", "15m")

	v.SetDefault("log.level", "info")
	v.SetDefault("log.development", false)
}

func (c *Config) ServerReadTimeout() time.Duration {
	return c.Server.ReadTimeout
}

func (c *Config) ServerWriteTimeout() time.Duration {
	return c.Server.WriteTimeout
}

func (c *Config) ServerIdleTimeout() time.Duration {
	return c.Server.IdleTimeout
}