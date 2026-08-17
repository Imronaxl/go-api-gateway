package auth

import (
	"context"
	"net/http"
	"strings"
)

type Config struct {
	SecretKey string
}

func NewJWTAuth(cfg Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "missing authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "invalid authorization format", http.StatusUnauthorized)
				return
			}

			token := parts[1]
			if token == "" {
				http.Error(w, "empty token", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), "user_id", "authenticated-user")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
