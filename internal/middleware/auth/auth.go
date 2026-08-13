// Package auth provides JWT authentication middleware.
package auth

import (
"context"
"net/http"
"strings"
)

// Config holds JWT authentication configuration.
type Config struct {
SecretKey string
}

// Middleware creates JWT authentication middleware.
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

// In production, validate JWT signature here
ctx := context.WithValue(r.Context(), "user_id", "authenticated-user")
next.ServeHTTP(w, r.WithContext(ctx))
})
}
}
