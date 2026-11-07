package metrics

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func scrape(t *testing.T, m *Metrics) string {
	t.Helper()
	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body, _ := io.ReadAll(rec.Body)
	return string(body)
}

func TestMiddlewareLabels(t *testing.T) {
	m := New()
	h := m.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/proxied" {
			w.Header().Set(BackendHeader, "b1")
			w.WriteHeader(http.StatusCreated)
			return
		}
		http.Error(w, "nope", http.StatusTooManyRequests)
	}))

	for _, path := range []string{"/proxied", "/proxied", "/local"} {
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, path, nil))
	}

	out := scrape(t, m)
	for _, want := range []string{
		`relay_http_requests_total{backend="b1",code="201",method="POST"} 2`,
		`relay_http_requests_total{backend="none",code="429",method="POST"} 1`,
		`relay_http_request_duration_seconds_count{backend="b1"} 2`,
		`relay_http_requests_in_flight 0`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("metrics output is missing %q", want)
		}
	}
}

func TestGauges(t *testing.T) {
	m := New()
	m.SetBackendUp("b1", false)
	m.SetBreakerState("b1", 1)
	m.AuthRejected("expired")
	m.RateLimited()
	m.UpstreamError("b1")

	out := scrape(t, m)
	for _, want := range []string{
		`relay_backend_up{backend="b1"} 0`,
		`relay_circuit_breaker_state{backend="b1"} 1`,
		`relay_auth_rejected_total{reason="expired"} 1`,
		`relay_ratelimit_rejected_total 1`,
		`relay_upstream_errors_total{backend="b1"} 1`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("metrics output is missing %q", want)
		}
	}
}
