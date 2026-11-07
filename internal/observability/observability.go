// Package observability sets up OpenTelemetry tracing.
package observability

import (
	"context"
	"fmt"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// InitTracing installs the W3C trace-context propagator and, when
// OTEL_EXPORTER_OTLP_ENDPOINT is set, a tracer provider that exports spans
// over OTLP/gRPC. Without an endpoint spans are still created (so trace IDs
// propagate to upstreams and logs) but nothing is exported.
func InitTracing(ctx context.Context, serviceName string) (shutdown func(context.Context) error, exporting bool, err error) {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))

	res, err := resource.Merge(resource.Default(), resource.NewWithAttributes(
		semconv.SchemaURL, semconv.ServiceName(serviceName),
	))
	if err != nil {
		return nil, false, fmt.Errorf("build resource: %w", err)
	}

	opts := []sdktrace.TracerProviderOption{sdktrace.WithResource(res)}
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "" {
		// The exporter reads the endpoint and TLS settings from the standard
		// OTEL_EXPORTER_OTLP_* variables.
		exp, err := otlptracegrpc.New(ctx)
		if err != nil {
			return nil, false, fmt.Errorf("create OTLP exporter: %w", err)
		}
		opts = append(opts, sdktrace.WithBatcher(exp))
		exporting = true
	}

	tp := sdktrace.NewTracerProvider(opts...)
	otel.SetTracerProvider(tp)
	return tp.Shutdown, exporting, nil
}
