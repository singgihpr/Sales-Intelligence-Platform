package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserContextKey contextKey = "user"

type JWTClaims struct {
	ID    string `json:"id"`
	Role  string `json:"role"`
	Email string `json:"email"`
	jwt.RegisteredClaims
}

func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				authHeader = r.Header.Get("authorization")
			}
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == "" || tokenStr == authHeader {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
			if err != nil {
				http.Error(w, `{"error":"Invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*JWTClaims)
			if !ok || !token.Valid {
				http.Error(w, `{"error":"Invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				authHeader = r.Header.Get("authorization")
			}
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr != "" && tokenStr != authHeader {
				token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
					return []byte(jwtSecret), nil
				})
				if err == nil {
					if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
						ctx := context.WithValue(r.Context(), UserContextKey, claims)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func GetUser(r *http.Request) *JWTClaims {
	claims, _ := r.Context().Value(UserContextKey).(*JWTClaims)
	return claims
}
