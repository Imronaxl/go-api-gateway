// Package ratelimit provides token bucket rate limiting middleware.
package ratelimit

import (
"net/http"
"sync"
"time"

"golang.org/x/time/rate"
)

// Config holds rate limiter configuration.
type Config struct {
Rate  float64 // tokens per second
Burst int     // maximum burst size
}

// TokenBucket implements a token bucket rate limiter.
type TokenBucket struct {
mu      sync.RWMutex
limiters map[string]*rate.Limiter
cfg     Config
}

// NewTokenBucket creates a new token bucket rate limiter.
func NewTokenBucket(cfg Config) *TokenBucket {
return &TokenBucket{
limiters: make(map[string]*rate.Limiter),
cfg:      cfg,
}
}

// getLimiter returns or creates a rate limiter for the given key.
func (tb *TokenBucket) getLimiter(key string) *rate.Limiter {
tb.mu.RLock()
limit, ok := tb.limiters[key]
tb.mu.RUnlock()

if ok {
return limit
}

tb.mu.Lock()
defer tb.mu.Unlock()

// Double-check after acquiring write lock
if limit, ok := tb.limiters[key]; ok {
return limit
}

limit = rate.NewLimiter(rate.Limit(tb.cfg.Rate), tb.cfg.Burst)
tb.limiters[key] = limit
return limit
}

// Middleware creates rate limiting middleware keyed by client IP.
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
