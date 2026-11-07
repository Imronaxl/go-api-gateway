package proxy

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/circuitbreaker"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/auth"
)

type upstream struct {
	*httptest.Server
	hits    atomic.Int64
	status  atomic.Int64
	healthy atomic.Bool
	lastReq atomic.Pointer[http.Request]
}

func newUpstream(t *testing.T, name string) *upstream {
	t.Helper()
	u := &upstream{}
	u.status.Store(http.StatusOK)
	u.healthy.Store(true)
	u.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			if !u.healthy.Load() {
				w.WriteHeader(http.StatusServiceUnavailable)
			}
			return
		}
		u.hits.Add(1)
		u.lastReq.Store(r.Clone(context.Background()))
		w.WriteHeader(int(u.status.Load()))
		_, _ = io.WriteString(w, name)
	}))
	t.Cleanup(u.Close)
	return u
}

func targets(t *testing.T, ups ...*upstream) []*url.URL {
	t.Helper()
	raw := make([]string, len(ups))
	for i, u := range ups {
		raw[i] = u.URL
	}
	out, err := ParseTargets(raw)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func get(p http.Handler, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestRoundRobin(t *testing.T) {
	a, b := newUpstream(t, "a"), newUpstream(t, "b")
	p, err := NewPool(targets(t, a, b), Config{Breaker: circuitbreaker.Config{MaxFailures: 3, OpenTimeout: time.Minute}})
	if err != nil {
		t.Fatal(err)
	}

	var bodies []string
	for i := 0; i < 4; i++ {
		rec := get(p, "/x")
		bodies = append(bodies, rec.Body.String())
		if rec.Header().Get(metrics.BackendHeader) == "" {
			t.Fatal("response has no backend header")
		}
	}
	want := []string{"a", "b", "a", "b"}
	for i := range want {
		if bodies[i] != want[i] {
			t.Fatalf("served by %v, want %v", bodies, want)
		}
	}
}

func TestBreakerIsolatesFailingBackend(t *testing.T) {
	a, b := newUpstream(t, "a"), newUpstream(t, "b")
	a.status.Store(http.StatusInternalServerError)

	var transitions []string
	var upstreamErrors atomic.Int64
	p, _ := NewPool(targets(t, a, b), Config{
		Breaker: circuitbreaker.Config{MaxFailures: 2, OpenTimeout: time.Minute},
		OnBreakerChange: func(id string, from, to circuitbreaker.State) {
			transitions = append(transitions, to.String())
		},
		OnUpstreamError: func(string) { upstreamErrors.Add(1) },
	})

	for i := 0; i < 10; i++ {
		get(p, "/x")
	}

	if got := a.hits.Load(); got != 2 {
		t.Fatalf("failing backend got %d requests, want 2 before its breaker opened", got)
	}
	if got := b.hits.Load(); got != 8 {
		t.Fatalf("healthy backend got %d requests, want 8", got)
	}
	if len(transitions) != 1 || transitions[0] != "open" {
		t.Fatalf("breaker transitions = %v, want [open]", transitions)
	}
	if upstreamErrors.Load() != 2 {
		t.Fatalf("OnUpstreamError called %d times, want 2", upstreamErrors.Load())
	}
}

func TestUnreachableBackendReturns502(t *testing.T) {
	dead := httptest.NewServer(http.NotFoundHandler())
	dead.Close()
	u, _ := url.Parse(dead.URL)

	p, _ := NewPool([]*url.URL{u}, Config{Breaker: circuitbreaker.Config{MaxFailures: 1, OpenTimeout: time.Minute}})

	if rec := get(p, "/x"); rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
	if rec := get(p, "/x"); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("with open breaker: status = %d, want 503", rec.Code)
	}
}

func TestUpstreamTimeoutReturns504(t *testing.T) {
	release := make(chan struct{})
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer slow.Close()
	defer close(release)
	u, _ := url.Parse(slow.URL)

	p, _ := NewPool([]*url.URL{u}, Config{
		Breaker:         circuitbreaker.Config{MaxFailures: 5, OpenTimeout: time.Minute},
		UpstreamTimeout: 50 * time.Millisecond,
	})

	if rec := get(p, "/x"); rec.Code != http.StatusGatewayTimeout {
		t.Fatalf("status = %d, want 504", rec.Code)
	}
}

func TestHealthChecks(t *testing.T) {
	a, b := newUpstream(t, "a"), newUpstream(t, "b")
	a.healthy.Store(false)

	changes := map[string]bool{}
	p, _ := NewPool(targets(t, a, b), Config{
		Breaker:        circuitbreaker.Config{MaxFailures: 1, OpenTimeout: time.Minute},
		OnHealthChange: func(id string, up bool) { changes[id] = up },
	})
	p.checkAll(context.Background())

	for i := 0; i < 4; i++ {
		if body := get(p, "/x").Body.String(); body != "b" {
			t.Fatalf("request %d served by %q, want only b", i, body)
		}
	}
	if up, ok := changes[p.backends[0].ID]; !ok || up {
		t.Fatalf("health changes = %v, want backend a reported down", changes)
	}

	a.healthy.Store(true)
	p.checkAll(context.Background())
	if !p.Status()[0].Up {
		t.Fatal("backend a did not come back up")
	}
}

func TestNoHealthyBackends(t *testing.T) {
	a := newUpstream(t, "a")
	a.healthy.Store(false)
	p, _ := NewPool(targets(t, a), Config{})
	p.checkAll(context.Background())

	if rec := get(p, "/x"); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestForwardedHeaders(t *testing.T) {
	a := newUpstream(t, "a")
	p, _ := NewPool(targets(t, a), Config{})

	verifier := auth.NewVerifier(auth.Config{Secret: []byte("s")})
	tok, _ := auth.Sign([]byte("s"), auth.Claims{Subject: "alice"})
	h := verifier.Middleware(p)

	req := httptest.NewRequest(http.MethodGet, "http://gw.example/items?id=1", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set(SubjectHeader, "admin") // spoofed by the client
	h.ServeHTTP(httptest.NewRecorder(), req)

	got := a.lastReq.Load()
	if got == nil {
		t.Fatal("upstream received no request")
	}
	if got.URL.Path != "/items" || got.URL.RawQuery != "id=1" {
		t.Fatalf("upstream got %s?%s", got.URL.Path, got.URL.RawQuery)
	}
	if s := got.Header.Get(SubjectHeader); s != "alice" {
		t.Fatalf("%s = %q, want alice", SubjectHeader, s)
	}
	if got.Header.Get("X-Forwarded-For") == "" || got.Host != "gw.example" {
		t.Fatalf("forwarding headers not set: XFF=%q Host=%q", got.Header.Get("X-Forwarded-For"), got.Host)
	}
}

func TestParseTargets(t *testing.T) {
	if _, err := ParseTargets([]string{"http://a:1", "https://b"}); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"localhost:8080", "ftp://x", "http://", "::"} {
		if _, err := ParseTargets([]string{bad}); err == nil {
			t.Errorf("ParseTargets(%q) succeeded, want error", bad)
		}
	}
}
