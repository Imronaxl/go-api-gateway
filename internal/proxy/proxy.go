package proxy

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync/atomic"
)

type Backend struct {
	URL    string
	Weight int
	Alive  atomic.Bool
}

type LoadBalancer struct {
	backends []Backend
	strategy Strategy
	current  atomic.Uint32
}

type Strategy func([]Backend, *atomic.Uint32) *Backend

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

func NewLoadBalancer(backends []Backend, strategy Strategy) *LoadBalancer {
	for i := range backends {
		backends[i].Alive.Store(true)
	}
	return &LoadBalancer{
		backends: backends,
		strategy: strategy,
	}
}

func (lb *LoadBalancer) SelectBackend() *Backend {
	return lb.strategy(lb.backends, &lb.current)
}

type ReverseProxy struct {
	proxy *httputil.ReverseProxy
}

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

func (rp *ReverseProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rp.proxy.ServeHTTP(w, r)
}

func CopyResponse(w http.ResponseWriter, resp *http.Response) {
	defer func() {
		_ = resp.Body.Close()
	}()

	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		return
	}
}
