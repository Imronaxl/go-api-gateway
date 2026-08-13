package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/relay-gw/relay/internal/middleware/auth"
	"github.com/relay-gw/relay/internal/middleware/circuitbreaker"
	"github.com/relay-gw/relay/internal/middleware/logging"
	"github.com/relay-gw/relay/internal/middleware/ratelimit"
	"github.com/relay-gw/relay/internal/middleware/tracing"
	"github.com/relay-gw/relay/internal/observability"
	"github.com/relay-gw/relay/internal/proxy"
)

func main() {
	if err := run(); err != nil {
		slog.Error("relay failed", "error", err)
		os.Exit(1)
	}
}

func run() error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	otelShutdown, err := observability.InitOTEL(ctx, "relay")
	if err != nil {
		return fmt.Errorf("init otel: %w", err)
	}
	defer func() {
		if err := otelShutdown(ctx); err != nil {
			logger.Error("otel shutdown failed", "error", err)
		}
	}()

	metricsServer := observability.StartMetricsServer(":9090")
	defer func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		if err := metricsServer.Shutdown(shutdownCtx); err != nil {
			logger.Error("metrics server shutdown failed", "error", err)
		}
	}()

	backends := []proxy.Backend{
		{URL: mustParseURL("http://localhost:8081")},
		{URL: mustParseURL("http://localhost:8083")},
	}

	lb := proxy.NewLoadBalancer(backends, proxy.RoundRobinStrategy)

	cb := circuitbreaker.New(circuitbreaker.Config{
		MaxFailures:   5,
		Timeout:       30 * time.Second,
		HalfOpenLimit: 3,
	})

	rl := ratelimit.NewTokenBucket(ratelimit.Config{
		Rate:  100,
		Burst: 50,
	})

	authMiddleware := auth.NewJWTAuth(auth.Config{
		SecretKey: getEnv("RELAY_AUTH_SECRET", "secret-key"),
	})

	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		backend := lb.SelectBackend()
		if backend == nil {
			http.Error(w, "no available backend", http.StatusServiceUnavailable)
			return
		}

		if cb.State() == circuitbreaker.StateOpen {
			http.Error(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Create proxy request to backend
		proxyURL := backend.URL + r.RequestURI
		proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, proxyURL, nil)
		if err != nil {
			cb.RecordFailure()
			http.Error(w, "backend error", http.StatusBadGateway)
			return
		}

		// Copy body if present
		if r.Body != nil {
			proxyReq.Body = r.Body
			proxyReq.ContentLength = r.ContentLength
		}

		// Copy headers from original request (excluding Host and Connection)
		for k, vv := range r.Header {
			if k != "Host" && k != "Connection" {
				for _, v := range vv {
					proxyReq.Header.Add(k, v)
				}
			}
		}

		resp, err := httpClient.Do(proxyReq)
		if err != nil {
			cb.RecordFailure()
			http.Error(w, "backend error", http.StatusBadGateway)
			return
		}

		cb.RecordSuccess()
		proxy.CopyResponse(w, resp)
	})

	chain := logging.Middleware(logger)(
		tracing.Middleware()(
			authMiddleware(
				rl.Middleware(
					handler,
				),
			),
		),
	)

	server := &http.Server{
		Addr:         ":8080",
		Handler:      chain,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		<-ctx.Done()
		logger.Info("shutting down server")

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("server shutdown failed", "error", err)
		}
	}()

	logger.Info("relay starting", "addr", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server: %w", err)
	}

	logger.Info("relay stopped")
	return nil
}

func mustParseURL(s string) string {
	return s
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
