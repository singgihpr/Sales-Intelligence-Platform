package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	DefaultPassword string
	DefaultUserID  string
	Environment    string
	JWTExpiry      time.Duration
	CorsOrigin     string
	MaxBodySize    int64
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "3000"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		JWTSecret:       getEnv("JWT_SECRET", "dev-secret"),
		DefaultPassword: getEnv("DEFAULT_PASSWORD", ""),
		DefaultUserID:   getEnv("DEFAULT_USER_ID", ""),
		Environment:     getEnv("ENVIRONMENT", "development"),
		JWTExpiry:       7 * 24 * time.Hour,
		CorsOrigin:      getEnv("CORS_ORIGIN", "*"),
		MaxBodySize:     getEnvInt64("MAX_BODY_SIZE", 10*1024*1024),
	}
}

func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if val := os.Getenv(key); val != "" {
		n, err := strconv.ParseInt(val, 10, 64)
		if err == nil {
			return n
		}
	}
	return fallback
}
