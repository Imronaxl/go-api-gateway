package gateway

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/config"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/auth"
)

const secret = "integration-test-secret"

func setup(t testing.TB, cfgFn func(*config.Config)) (*httptest.Server, *metrics.Metrics) {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"path":    r.URL.Path,
			"subject": r.Header.Get("X-Auth-Subject"),
		})
	}))
	t.Cleanup(backend.Close)

	cfg := config.Config{
		Backends:                []string{backend.URL},
		JWTSecret:               secret,
		RateLimitRPS:            1000,
		RateLimitBurst:          1000,
		BreakerMaxFailures:      3,
		BreakerOpenTimeout:      time.Minute,
		BreakerHalfOpenRequests: 1,
		UpstreamTimeout:         time.Second,
		HealthPath:              "/health",
	}
	if cfgFn != nil {
		cfgFn(&cfg)
	}

	m := metrics.New()
	gw, err := New(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), m, nil)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(gw.Handler)
	t.Cleanup(srv.Close)
	return srv, m
}

func token(t *testing.T, sub string) string {
	t.Helper()
	tok, err := auth.Sign([]byte(secret), auth.Claims{Subject: sub})
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func request(t *testing.T, method, url, tok string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(method, url, nil)
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func TestProxiesAuthenticatedRequests(t *testing.T) {
	srv, _ := setup(t, nil)

	resp := request(t, http.MethodGet, srv.URL+"/api/users", token(t, "alice"))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["path"] != "/api/users" || body["subject"] != "alice" {
		t.Fatalf("backend saw %v", body)
	}

	st := resp.Header.Get("Server-Timing")
	for _, stage := range []string{"ratelimit;", "auth;", "balancer;", "upstream;", "total;"} {
		if !strings.Contains(st, stage) {
			t.Errorf("Server-Timing %q has no %s stage", st, stage)
		}
	}
	if resp.Header.Get("X-Backend-Id") == "" {
		t.Error("X-Backend-Id is missing")
	}
}

func TestRejectsMissingToken(t *testing.T) {
	srv, m := setup(t, nil)

	if resp := request(t, http.MethodGet, srv.URL+"/api/users", ""); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}

	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if !strings.Contains(rec.Body.String(), `relay_auth_rejected_total{reason="missing"} 1`) {
		t.Fatal("auth rejection was not counted")
	}
}

func TestHealthzIsPublic(t *testing.T) {
	srv, _ := setup(t, nil)
	if resp := request(t, http.MethodGet, srv.URL+"/healthz", ""); resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestRateLimitRunsBeforeAuth(t *testing.T) {
	srv, _ := setup(t, func(c *config.Config) {
		c.RateLimitRPS = 0.001
		c.RateLimitBurst = 2
	})

	codes := []int{}
	for i := 0; i < 3; i++ {
		codes = append(codes, request(t, http.MethodGet, srv.URL+"/x", "").StatusCode)
	}
	if codes[0] != 401 || codes[1] != 401 || codes[2] != 429 {
		t.Fatalf("status codes = %v, want [401 401 429]", codes)
	}
}

func TestStatusEndpoint(t *testing.T) {
	srv, _ := setup(t, nil)

	resp := request(t, http.MethodGet, srv.URL+StatusPath, token(t, "ops"))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	var body struct {
		Backends []struct {
			Up      bool   `json:"up"`
			Breaker string `json:"breaker"`
		} `json:"backends"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Backends) != 1 || !body.Backends[0].Up || body.Backends[0].Breaker != "closed" {
		t.Fatalf("status = %+v", body)
	}
}

func TestCORSPreflightSkipsAuth(t *testing.T) {
	srv, _ := setup(t, func(c *config.Config) { c.CORSOrigins = []string{"http://localhost:3000"} })

	req, _ := http.NewRequest(http.MethodOptions, srv.URL+"/api/users", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", resp.StatusCode)
	}
}

// BenchmarkPipeline measures the cost of the full middleware chain plus
// proxying to an in-process upstream. Compare with BenchmarkDirect to get the
// overhead the gateway adds.
func BenchmarkPipeline(b *testing.B) {
	srv, _ := setup(b, func(c *config.Config) {
		c.RateLimitRPS = 1e9
		c.RateLimitBurst = 1e9
	})
	tok, _ := auth.Sign([]byte(secret), auth.Claims{Subject: "bench"})
	benchGet(b, srv.URL+"/api/users", tok)
}

func BenchmarkDirect(b *testing.B) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"path": r.URL.Path})
	}))
	defer backend.Close()
	benchGet(b, backend.URL+"/api/users", "")
}

func benchGet(b *testing.B, url, tok string) {
	client := &http.Client{Transport: &http.Transport{MaxIdleConnsPerHost: 64}}
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest(http.MethodGet, url, nil)
			if tok != "" {
				req.Header.Set("Authorization", "Bearer "+tok)
			}
			resp, err := client.Do(req)
			if err != nil {
				b.Error(err)
				return
			}
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
		}
	})
}
