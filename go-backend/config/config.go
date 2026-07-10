package config

import "os"

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	DefaultPassword string
}

func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "3000"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://salesintel:password@localhost:5432/salesintel"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-secret"),
		DefaultPassword: getEnv("DEFAULT_PASSWORD", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
