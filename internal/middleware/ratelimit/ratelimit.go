package ratelimit

import (
	"net/http"
	"sync"

	"golang.org/x/time/rate"
)

type Config struct {
	Rate  float64
	Burst int
}

type TokenBucket struct {
	mu       sync.RWMutex
	limiters map[string]*rate.Limiter
	cfg      Config
}

func NewTokenBucket(cfg Config) *TokenBucket {
	return &TokenBucket{
		limiters: make(map[string]*rate.Limiter),
		cfg:      cfg,
	}
}

func (tb *TokenBucket) getLimiter(key string) *rate.Limiter {
	tb.mu.RLock()
	limit, ok := tb.limiters[key]
	tb.mu.RUnlock()

	if ok {
		return limit
	}

	tb.mu.Lock()
	defer tb.mu.Unlock()

	if limit, ok := tb.limiters[key]; ok {
		return limit
	}

	limit = rate.NewLimiter(rate.Limit(tb.cfg.Rate), tb.cfg.Burst)
	tb.limiters[key] = limit
	return limit
}

func (tb *TokenBucket) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := r.RemoteAddr
		limit := tb.getLimiter(clientIP)

		if !limit.Allow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}
