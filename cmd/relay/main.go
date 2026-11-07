// Command relay runs the API gateway.
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

	"github.com/Imronaxl/go-api-gateway/internal/audit"
	"github.com/Imronaxl/go-api-gateway/internal/config"
	"github.com/Imronaxl/go-api-gateway/internal/gateway"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
	"github.com/Imronaxl/go-api-gateway/internal/middleware/cors"
	"github.com/Imronaxl/go-api-gateway/internal/observability"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("relay stopped with error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.FromEnv()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	shutdownTracing, exporting, err := observability.InitTracing(ctx, "relay")
	if err != nil {
		return fmt.Errorf("tracing: %w", err)
	}

	var pub *audit.Publisher
	if len(cfg.KafkaBrokers) > 0 {
		pub = audit.NewPublisher(audit.Config{Brokers: cfg.KafkaBrokers, Topic: cfg.KafkaTopic})
	}

	m := metrics.New()
	gw, err := gateway.New(cfg, logger, m, pub)
	if err != nil {
		return err
	}

	go gw.Pool.RunHealthChecks(ctx)
	go gw.Limiter.RunEviction(time.Minute, ctx.Done())

	servers := []*http.Server{
		{
			Addr:              cfg.ListenAddr,
			Handler:           gw.Handler,
			ReadHeaderTimeout: 5 * time.Second,
			IdleTimeout:       120 * time.Second,
		},
		{
			Addr:              cfg.MetricsAddr,
			Handler:           metricsMux(m, cfg.CORSOrigins),
			ReadHeaderTimeout: 5 * time.Second,
		},
	}

	errs := make(chan error, len(servers))
	for _, srv := range servers {
		go func(srv *http.Server) {
			if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errs <- fmt.Errorf("listen %s: %w", srv.Addr, err)
			}
		}(srv)
	}

	logger.Info("relay started",
		"addr", cfg.ListenAddr,
		"metrics_addr", cfg.MetricsAddr,
		"backends", cfg.Backends,
		"tracing_export", exporting,
		"audit", pub != nil,
	)

	var runErr error
	select {
	case <-ctx.Done():
		logger.Info("shutting down")
	case runErr = <-errs:
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	for _, srv := range servers {
		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("server shutdown", "addr", srv.Addr, "error", err)
		}
	}
	if pub != nil {
		if err := pub.Close(); err != nil {
			logger.Error("audit publisher close", "error", err)
		}
		logger.Info("audit publisher closed", "dropped_events", pub.Dropped())
	}
	if err := shutdownTracing(shutdownCtx); err != nil {
		logger.Error("tracing shutdown", "error", err)
	}
	return runErr
}

func metricsMux(m *metrics.Metrics, corsOrigins []string) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /metrics", m.Handler())
	return cors.Middleware(corsOrigins)(mux)
}
