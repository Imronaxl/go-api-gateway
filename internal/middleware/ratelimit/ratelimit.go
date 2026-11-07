// Package ratelimit applies a per-client token bucket to incoming requests.
package ratelimit

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type Config struct {
	// Rate is the sustained number of requests per second per client.
	Rate float64
	// Burst is the bucket size.
	Burst int
	// TrustForwardedFor keys clients by the first X-Forwarded-For address.
	// Enable it only when the gateway runs behind a trusted proxy.
	TrustForwardedFor bool
	// IdleTTL removes buckets of clients that have been quiet this long.
	IdleTTL time.Duration
	// OnReject, if set, is called for every rejected request.
	OnReject func()
}

type client struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type Limiter struct {
	cfg     Config
	mu      sync.Mutex
	clients map[string]*client
	now     func() time.Time
}

func New(cfg Config) *Limiter {
	if cfg.IdleTTL <= 0 {
		cfg.IdleTTL = 10 * time.Minute
	}
	return &Limiter{cfg: cfg, clients: make(map[string]*client), now: time.Now}
}

// reserve takes one token for key. It returns 0 when the request may proceed,
// otherwise how long the client should wait before retrying.
func (l *Limiter) reserve(key string) time.Duration {
	now := l.now()

	l.mu.Lock()
	c, ok := l.clients[key]
	if !ok {
		c = &client{limiter: rate.NewLimiter(rate.Limit(l.cfg.Rate), l.cfg.Burst)}
		l.clients[key] = c
	}
	c.lastSeen = now
	l.mu.Unlock()

	r := c.limiter.ReserveN(now, 1)
	if !r.OK() {
		return time.Second
	}
	if d := r.DelayFrom(now); d > 0 {
		r.CancelAt(now)
		return d
	}
	return 0
}

// Evict drops buckets for clients idle longer than IdleTTL and returns how
// many were removed.
func (l *Limiter) Evict() int {
	cutoff := l.now().Add(-l.cfg.IdleTTL)
	l.mu.Lock()
	defer l.mu.Unlock()

	removed := 0
	for k, c := range l.clients {
		if c.lastSeen.Before(cutoff) {
			delete(l.clients, k)
			removed++
		}
	}
	return removed
}

// RunEviction calls Evict every interval until stop is closed.
func (l *Limiter) RunEviction(interval time.Duration, stop <-chan struct{}) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			l.Evict()
		case <-stop:
			return
		}
	}
}

func (l *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if wait := l.reserve(l.clientKey(r)); wait > 0 {
			if l.cfg.OnReject != nil {
				l.cfg.OnReject()
			}
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *Limiter) clientKey(r *http.Request) string {
	if l.cfg.TrustForwardedFor {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			first, _, _ := strings.Cut(xff, ",")
			if ip := strings.TrimSpace(first); ip != "" {
				return ip
			}
		}
	}
	// RemoteAddr is "ip:port"; the port changes per connection, so it must
	// not be part of the key.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
