// Package gateway wires the middleware chain and the proxy pool into a
// single http.Handler.
package gateway

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/audit"
	"github.com/Imronaxl/go-api-gateway/internal/circuitbreaker"
	"github.com/Imronaxl/go-api-gateway/internal/config"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/auth"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/cors"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/logging"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/ratelimit"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/tracing"
	"github.com/Imronaxl/go-api-gateway/internal/proxy"
	"github.com/Imronaxl/go-api-gateway/internal/timing"
)

// StatusPath returns backend health and breaker states as JSON.
const StatusPath = "/_relay/status"

type Gateway struct {
	Handler http.Handler
	Pool    *proxy.Pool
	Limiter *ratelimit.Limiter
}

// New builds the request pipeline:
//
//	metrics -> logging -> audit -> tracing -> timing -> cors -> routes
//
// where every route except /healthz goes through rate limiting and JWT
// verification. The rate limiter runs first so unauthenticated floods are
// limited too.
func New(cfg config.Config, logger *slog.Logger, m *metrics.Metrics, pub *audit.Publisher) (*Gateway, error) {
	targets, err := proxy.ParseTargets(cfg.Backends)
	if err != nil {
		return nil, err
	}

	pool, err := proxy.NewPool(targets, proxy.Config{
		Breaker: circuitbreaker.Config{
			MaxFailures:      cfg.BreakerMaxFailures,
			OpenTimeout:      cfg.BreakerOpenTimeout,
			HalfOpenRequests: cfg.BreakerHalfOpenRequests,
		},
		UpstreamTimeout: cfg.UpstreamTimeout,
		HealthPath:      cfg.HealthPath,
		HealthInterval:  cfg.HealthInterval,
		OnBreakerChange: func(id string, from, to circuitbreaker.State) {
			m.SetBreakerState(id, int(to))
			logger.Warn("circuit breaker state changed", "backend", id, "from", from.String(), "to", to.String())
		},
		OnHealthChange: func(id string, up bool) {
			m.SetBackendUp(id, up)
			logger.Warn("backend health changed", "backend", id, "up", up)
		},
		OnUpstreamError: m.UpstreamError,
	})
	if err != nil {
		return nil, err
	}
	for _, s := range pool.Status() {
		m.SetBackendUp(s.ID, s.Up)
		m.SetBreakerState(s.ID, int(circuitbreaker.StateClosed))
	}

	limiter := ratelimit.New(ratelimit.Config{
		Rate:              cfg.RateLimitRPS,
		Burst:             cfg.RateLimitBurst,
		TrustForwardedFor: cfg.TrustForwardedFor,
		OnReject:          m.RateLimited,
	})
	verifier := auth.NewVerifier(auth.Config{
		Secret: []byte(cfg.JWTSecret),
		Leeway: 30 * time.Second,
		OnReject: func(err error) {
			m.AuthRejected(rejectReason(err))
		},
	})

	protected := func(h http.Handler) http.Handler {
		return stage("ratelimit", limiter.Middleware(stage("auth", verifier.Middleware(h))))
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("GET "+StatusPath, protected(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"backends": pool.Status()})
	})))
	mux.Handle("/", protected(pool))

	var h http.Handler = cors.Middleware(cfg.CORSOrigins)(mux)
	h = timing.Middleware(h)
	h = tracing.Middleware(h)
	if pub != nil {
		h = pub.Middleware(h)
	}
	h = logging.Middleware(logger)(h)
	h = m.Middleware(h)

	return &Gateway{Handler: h, Pool: pool, Limiter: limiter}, nil
}

func stage(name string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		timing.Mark(r.Context(), name)
		next.ServeHTTP(w, r)
	})
}

func rejectReason(err error) string {
	switch {
	case errors.Is(err, auth.ErrMissingToken):
		return "missing"
	case errors.Is(err, auth.ErrExpired), errors.Is(err, auth.ErrNotYetValid):
		return "expired"
	case errors.Is(err, auth.ErrInvalidSignature):
		return "signature"
	default:
		return "malformed"
	}
}
