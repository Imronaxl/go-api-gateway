// Package cors lets browser clients (the dashboard) call the gateway from
// another origin.
package cors

import (
	"net/http"
	"slices"
)

var exposed = "Server-Timing, X-Backend-Id, X-Trace-Id, Retry-After"

// Middleware allows the listed origins ("*" allows any). Preflight requests
// are answered here so they never reach auth or the rate limiter.
func Middleware(origins []string) func(http.Handler) http.Handler {
	anyOrigin := slices.Contains(origins, "*")

	return func(next http.Handler) http.Handler {
		if len(origins) == 0 {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" || (!anyOrigin && !slices.Contains(origins, origin)) {
				next.ServeHTTP(w, r)
				return
			}

			h := w.Header()
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Expose-Headers", exposed)
			h.Set("Timing-Allow-Origin", origin)

			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				allowed := "Authorization, Content-Type"
				if req := r.Header.Get("Access-Control-Request-Headers"); req != "" {
					allowed = req // the origin is trusted, so allow the headers it asks for
				}
				h.Set("Access-Control-Allow-Headers", allowed)
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
