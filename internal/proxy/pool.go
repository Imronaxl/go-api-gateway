// Package proxy forwards requests to a pool of upstream backends with
// round-robin selection, active health checks and a circuit breaker per
// backend.
package proxy

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"

	"github.com/Imronaxl/go-api-gateway/internal/circuitbreaker"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/auth"
	"github.com/Imronaxl/go-api-gateway/internal/timing"
)

// SubjectHeader carries the authenticated JWT subject to upstreams. Any value
// sent by the client is overwritten.
const SubjectHeader = "X-Auth-Subject"

type Config struct {
	Breaker         circuitbreaker.Config
	UpstreamTimeout time.Duration
	HealthPath      string
	HealthInterval  time.Duration
	HealthTimeout   time.Duration

	OnBreakerChange func(backend string, from, to circuitbreaker.State)
	OnHealthChange  func(backend string, up bool)
	OnUpstreamError func(backend string)
}

type Backend struct {
	ID      string
	URL     *url.URL
	proxy   *httputil.ReverseProxy
	breaker *circuitbreaker.CircuitBreaker
	up      atomic.Bool
}

type Pool struct {
	cfg      Config
	backends []*Backend
	next     atomic.Uint64
	client   *http.Client
}

func NewPool(targets []*url.URL, cfg Config) (*Pool, error) {
	if len(targets) == 0 {
		return nil, errors.New("proxy: at least one backend is required")
	}
	if cfg.HealthPath == "" {
		cfg.HealthPath = "/health"
	}
	if cfg.HealthTimeout <= 0 {
		cfg.HealthTimeout = 2 * time.Second
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = cfg.UpstreamTimeout
	transport.MaxIdleConnsPerHost = 64

	p := &Pool{
		cfg:    cfg,
		client: &http.Client{Timeout: cfg.HealthTimeout},
	}
	for _, u := range targets {
		b := &Backend{ID: u.Host, URL: u}
		b.up.Store(true) // optimistic until the first health check runs

		bcfg := cfg.Breaker
		bcfg.OnStateChange = func(from, to circuitbreaker.State) {
			if cfg.OnBreakerChange != nil {
				cfg.OnBreakerChange(b.ID, from, to)
			}
		}
		b.breaker = circuitbreaker.New(bcfg)
		b.proxy = p.newReverseProxy(b, transport)
		p.backends = append(p.backends, b)
	}
	return p, nil
}

func (p *Pool) newReverseProxy(b *Backend, transport http.RoundTripper) *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Transport: transport,
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(b.URL)
			pr.SetXForwarded()
			pr.Out.Host = pr.In.Host

			pr.Out.Header.Del(SubjectHeader)
			if sub := auth.Subject(pr.In.Context()); sub != "" {
				pr.Out.Header.Set(SubjectHeader, sub)
			}
			otel.GetTextMapPropagator().Inject(pr.Out.Context(), propagation.HeaderCarrier(pr.Out.Header))
		},
		ModifyResponse: func(resp *http.Response) error {
			if resp.StatusCode >= http.StatusInternalServerError {
				p.fail(b)
			} else {
				b.breaker.RecordSuccess()
			}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			if r.Context().Err() != nil {
				// The client went away; that says nothing about the backend,
				// so the breaker is left untouched.
				w.WriteHeader(499)
				return
			}
			p.fail(b)

			var nerr net.Error
			if errors.As(err, &nerr) && nerr.Timeout() {
				http.Error(w, "upstream timeout", http.StatusGatewayTimeout)
				return
			}
			http.Error(w, "bad gateway", http.StatusBadGateway)
		},
	}
}

func (p *Pool) fail(b *Backend) {
	b.breaker.RecordFailure()
	if p.cfg.OnUpstreamError != nil {
		p.cfg.OnUpstreamError(b.ID)
	}
}

// pick returns the next healthy backend whose breaker admits a request.
func (p *Pool) pick() *Backend {
	n := uint64(len(p.backends))
	start := p.next.Add(1) - 1
	for i := uint64(0); i < n; i++ {
		b := p.backends[(start+i)%n]
		if b.up.Load() && b.breaker.Allow() {
			return b
		}
	}
	return nil
}

func (p *Pool) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	timing.Mark(r.Context(), "balancer")
	b := p.pick()
	if b == nil {
		http.Error(w, "no healthy upstream", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set(metrics.BackendHeader, b.ID)
	timing.Mark(r.Context(), "upstream")
	b.proxy.ServeHTTP(w, r)
}

// RunHealthChecks probes every backend immediately and then every
// HealthInterval until ctx is cancelled.
func (p *Pool) RunHealthChecks(ctx context.Context) {
	p.checkAll(ctx)
	if p.cfg.HealthInterval <= 0 {
		return
	}
	t := time.NewTicker(p.cfg.HealthInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			p.checkAll(ctx)
		}
	}
}

func (p *Pool) checkAll(ctx context.Context) {
	var wg sync.WaitGroup
	for _, b := range p.backends {
		wg.Add(1)
		go func(b *Backend) {
			defer wg.Done()
			up := p.check(ctx, b)
			if b.up.Swap(up) != up && p.cfg.OnHealthChange != nil {
				p.cfg.OnHealthChange(b.ID, up)
			}
		}(b)
	}
	wg.Wait()
}

func (p *Pool) check(ctx context.Context, b *Backend) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.URL.JoinPath(p.cfg.HealthPath).String(), nil)
	if err != nil {
		return false
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return false
	}
	_ = resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

type BackendStatus struct {
	ID      string `json:"id"`
	URL     string `json:"url"`
	Up      bool   `json:"up"`
	Breaker string `json:"breaker"`
}

func (p *Pool) Status() []BackendStatus {
	out := make([]BackendStatus, 0, len(p.backends))
	for _, b := range p.backends {
		out = append(out, BackendStatus{
			ID:      b.ID,
			URL:     b.URL.String(),
			Up:      b.up.Load(),
			Breaker: b.breaker.State().String(),
		})
	}
	return out
}

// ParseTargets parses a list of absolute http(s) URLs.
func ParseTargets(raw []string) ([]*url.URL, error) {
	out := make([]*url.URL, 0, len(raw))
	for _, s := range raw {
		u, err := url.Parse(s)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return nil, fmt.Errorf("invalid backend URL %q", s)
		}
		out = append(out, u)
	}
	return out, nil
}
