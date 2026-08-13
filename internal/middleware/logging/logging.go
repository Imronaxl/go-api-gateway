// Package logging provides structured logging middleware.
package logging

import (
"log/slog"
"net/http"
"time"
)

// Middleware creates logging middleware.
func Middleware(logger *slog.Logger) func(http.Handler) http.Handler {
return func(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
start := time.Now()

next.ServeHTTP(w, r)

logger.Info("request",
"method", r.Method,
"path", r.URL.Path,
"duration", time.Since(start).String(),
)
})
}
}
