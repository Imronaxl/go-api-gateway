// Package proxy provides reverse proxy and load balancing functionality.
package proxy

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync/atomic"
)

// Backend represents a target backend server.
type Backend struct {
	URL    string
	Weight int
	Alive  atomic.Bool
}

// LoadBalancer distributes requests across backends.
type LoadBalancer struct {
	backends []Backend
	strategy Strategy
	current  atomic.Uint32
}

// Strategy defines the load balancing algorithm.
type Strategy func([]Backend, *atomic.Uint32) *Backend

// RoundRobinStrategy implements round-robin load balancing.
func RoundRobinStrategy(backends []Backend, current *atomic.Uint32) *Backend {
	n := uint32(len(backends))
	if n == 0 {
		return nil
	}

	for i := 0; i < int(n); i++ {
		idx := current.Add(1) % n
		if backends[idx].Alive.Load() {
			return &backends[idx]
		}
	}
	return nil
}

// NewLoadBalancer creates a new load balancer with the specified strategy.
func NewLoadBalancer(backends []Backend, strategy Strategy) *LoadBalancer {
	for i := range backends {
		backends[i].Alive.Store(true)
	}
	return &LoadBalancer{
		backends: backends,
		strategy: strategy,
	}
}

// SelectBackend returns the next available backend according to the strategy.
func (lb *LoadBalancer) SelectBackend() *Backend {
	return lb.strategy(lb.backends, &lb.current)
}

// ReverseProxy wraps httputil.ReverseProxy with additional features.
type ReverseProxy struct {
	proxy *httputil.ReverseProxy
}

// NewReverseProxy creates a new reverse proxy for the given target.
func NewReverseProxy(targetURL string) (*ReverseProxy, error) {
	target, err := url.Parse(targetURL)
	if err != nil {
		return nil, fmt.Errorf("parse target URL: %w", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, "backend error", http.StatusBadGateway)
	}

	return &ReverseProxy{proxy: proxy}, nil
}

// ServeHTTP implements http.Handler.
func (rp *ReverseProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rp.proxy.ServeHTTP(w, r)
}

// CopyResponse copies the backend response to the client.
func CopyResponse(w http.ResponseWriter, resp *http.Response) {
	defer resp.Body.Close()

	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
