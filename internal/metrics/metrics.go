// Package metrics defines the gateway's Prometheus metrics.
package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
)

// BackendHeader is set by the proxy to the ID of the upstream that served
// the request. Responses produced by the gateway itself have no backend.
const BackendHeader = "X-Backend-Id"

type Metrics struct {
	registry *prometheus.Registry

	requests     *prometheus.CounterVec
	duration     *prometheus.HistogramVec
	inFlight     prometheus.Gauge
	rateLimited  prometheus.Counter
	authRejected *prometheus.CounterVec
	upstreamErrs *prometheus.CounterVec
	backendUp    *prometheus.GaugeVec
	breaker      *prometheus.GaugeVec
}

func New() *Metrics {
	m := &Metrics{
		registry: prometheus.NewRegistry(),
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "relay_http_requests_total",
			Help: "Requests handled by the gateway.",
		}, []string{"method", "code", "backend"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "relay_http_request_duration_seconds",
			Help:    "End-to-end request latency as seen by the gateway.",
			Buckets: []float64{.001, .0025, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		}, []string{"backend"}),
		inFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "relay_http_requests_in_flight",
			Help: "Requests currently being served.",
		}),
		rateLimited: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "relay_ratelimit_rejected_total",
			Help: "Requests rejected by the rate limiter.",
		}),
		authRejected: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "relay_auth_rejected_total",
			Help: "Requests rejected by JWT verification.",
		}, []string{"reason"}),
		upstreamErrs: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "relay_upstream_errors_total",
			Help: "Upstream transport errors and 5xx responses.",
		}, []string{"backend"}),
		backendUp: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "relay_backend_up",
			Help: "1 if the last health check of the backend passed.",
		}, []string{"backend"}),
		breaker: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "relay_circuit_breaker_state",
			Help: "Circuit breaker state per backend: 0 closed, 1 open, 2 half-open.",
		}, []string{"backend"}),
	}

	m.registry.MustRegister(
		m.requests, m.duration, m.inFlight, m.rateLimited, m.authRejected,
		m.upstreamErrs, m.backendUp, m.breaker,
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
	return m
}

func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{Registry: m.registry})
}

func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		m.inFlight.Inc()
		defer m.inFlight.Dec()

		rw := httpx.Wrap(w)
		next.ServeHTTP(rw, r)

		backend := rw.Header().Get(BackendHeader)
		if backend == "" {
			backend = "none"
		}
		m.requests.WithLabelValues(r.Method, strconv.Itoa(rw.Status()), backend).Inc()
		m.duration.WithLabelValues(backend).Observe(time.Since(start).Seconds())
	})
}

func (m *Metrics) RateLimited()               { m.rateLimited.Inc() }
func (m *Metrics) AuthRejected(reason string) { m.authRejected.WithLabelValues(reason).Inc() }
func (m *Metrics) UpstreamError(backend string) {
	m.upstreamErrs.WithLabelValues(backend).Inc()
}

func (m *Metrics) SetBackendUp(backend string, up bool) {
	v := 0.0
	if up {
		v = 1
	}
	m.backendUp.WithLabelValues(backend).Set(v)
}

// SetBreakerState takes the numeric value of circuitbreaker.State.
func (m *Metrics) SetBreakerState(backend string, state int) {
	m.breaker.WithLabelValues(backend).Set(float64(state))
}
