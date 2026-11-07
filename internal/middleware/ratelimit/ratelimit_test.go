package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestLimiter(cfg Config) (*Limiter, *fakeClock, http.Handler) {
	clock := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := New(cfg)
	l.now = clock.now
	h := l.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	return l, clock, h
}

func do(h http.Handler, remoteAddr, xff string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = remoteAddr
	if xff != "" {
		req.Header.Set("X-Forwarded-For", xff)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestBurstThenReject(t *testing.T) {
	rejected := 0
	_, _, h := newTestLimiter(Config{Rate: 1, Burst: 3, OnReject: func() { rejected++ }})

	for i := 0; i < 3; i++ {
		if rec := do(h, "10.0.0.1:1000", ""); rec.Code != http.StatusOK {
			t.Fatalf("request %d: status = %d, want 200", i, rec.Code)
		}
	}

	rec := do(h, "10.0.0.1:1000", "")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "1" {
		t.Fatalf("Retry-After = %q, want 1", got)
	}
	if rejected != 1 {
		t.Fatalf("OnReject called %d times, want 1", rejected)
	}
}

func TestTokensRefill(t *testing.T) {
	_, clock, h := newTestLimiter(Config{Rate: 2, Burst: 1})

	do(h, "10.0.0.1:1", "")
	if rec := do(h, "10.0.0.1:1", ""); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rec.Code)
	}

	clock.advance(500 * time.Millisecond)
	if rec := do(h, "10.0.0.1:1", ""); rec.Code != http.StatusOK {
		t.Fatalf("after refill: status = %d, want 200", rec.Code)
	}
}

func TestRejectedRequestDoesNotConsumeToken(t *testing.T) {
	_, clock, h := newTestLimiter(Config{Rate: 1, Burst: 1})

	do(h, "10.0.0.1:1", "")
	for i := 0; i < 5; i++ {
		do(h, "10.0.0.1:1", "") // rejected, must not push the next token further away
	}

	clock.advance(time.Second)
	if rec := do(h, "10.0.0.1:1", ""); rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestPortIsNotPartOfClientKey(t *testing.T) {
	_, _, h := newTestLimiter(Config{Rate: 1, Burst: 1})

	do(h, "10.0.0.1:1000", "")
	if rec := do(h, "10.0.0.1:2000", ""); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("new port bypassed the limit: status = %d", rec.Code)
	}
	if rec := do(h, "10.0.0.2:1000", ""); rec.Code != http.StatusOK {
		t.Fatalf("different client was limited: status = %d", rec.Code)
	}
}

func TestForwardedFor(t *testing.T) {
	t.Run("ignored by default", func(t *testing.T) {
		_, _, h := newTestLimiter(Config{Rate: 1, Burst: 1})
		do(h, "10.0.0.1:1", "1.1.1.1")
		if rec := do(h, "10.0.0.1:1", "2.2.2.2"); rec.Code != http.StatusTooManyRequests {
			t.Fatal("spoofed X-Forwarded-For bypassed the limit")
		}
	})

	t.Run("used when trusted", func(t *testing.T) {
		_, _, h := newTestLimiter(Config{Rate: 1, Burst: 1, TrustForwardedFor: true})
		do(h, "10.0.0.1:1", "1.1.1.1, 10.0.0.1")
		if rec := do(h, "10.0.0.1:1", "2.2.2.2, 10.0.0.1"); rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if rec := do(h, "10.0.0.1:1", "1.1.1.1"); rec.Code != http.StatusTooManyRequests {
			t.Fatalf("status = %d, want 429", rec.Code)
		}
	})
}

func TestEvict(t *testing.T) {
	l, clock, h := newTestLimiter(Config{Rate: 1, Burst: 1, IdleTTL: time.Minute})

	do(h, "10.0.0.1:1", "")
	clock.advance(30 * time.Second)
	do(h, "10.0.0.2:1", "")
	clock.advance(31 * time.Second)

	if n := l.Evict(); n != 1 {
		t.Fatalf("Evict() removed %d clients, want 1", n)
	}
	if _, ok := l.clients["10.0.0.2"]; !ok {
		t.Fatal("active client was evicted")
	}
}
