// Package logging writes one structured log line per request.
package logging

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
)

func Middleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ctx, info := httpx.WithInfo(r.Context())
			rw := httpx.Wrap(w)

			next.ServeHTTP(rw, r.WithContext(ctx))

			level := slog.LevelInfo
			if rw.Status() >= http.StatusInternalServerError {
				level = slog.LevelError
			}

			attrs := []slog.Attr{
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rw.Status()),
				slog.Int64("bytes", rw.Bytes()),
				slog.Float64("duration_ms", float64(time.Since(start).Microseconds())/1000),
				slog.String("remote", r.RemoteAddr),
			}
			if b := rw.Header().Get(metrics.BackendHeader); b != "" {
				attrs = append(attrs, slog.String("backend", b))
			}
			if info.Subject != "" {
				attrs = append(attrs, slog.String("subject", info.Subject))
			}
			if info.TraceID != "" {
				attrs = append(attrs, slog.String("trace_id", info.TraceID))
			}
			logger.LogAttrs(ctx, level, "request", attrs...)
		})
	}
}
