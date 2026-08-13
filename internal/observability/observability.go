
package observability

import (
"context"
"fmt"
"net/http"

prom "github.com/prometheus/client_golang/prometheus/promhttp"
"go.opentelemetry.io/otel"
"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
"go.opentelemetry.io/otel/sdk/resource"
sdktrace "go.opentelemetry.io/otel/sdk/trace"
semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)


func InitOTEL(ctx context.Context, serviceName string) (func(context.Context) error, error) {
res, err := resource.New(ctx,
resource.WithAttributes(semconv.ServiceName(serviceName)),
)
if err != nil {
return nil, fmt.Errorf("create resource: %w", err)
}

exporter, err := otlptracegrpc.New(ctx,
otlptracegrpc.WithInsecure(),
otlptracegrpc.WithEndpoint("localhost:4317"),
)
if err != nil {
return nil, fmt.Errorf("create exporter: %w", err)
}

tp := sdktrace.NewTracerProvider(
sdktrace.WithResource(res),
sdktrace.WithBatcher(exporter),
)
otel.SetTracerProvider(tp)

return tp.Shutdown, nil
}


func StartMetricsServer(addr string) *http.Server {
mux := http.NewServeMux()
mux.Handle("/metrics", prom.Handler())

server := &http.Server{
Addr:    addr,
Handler: mux,
}

go func() {
if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
panic(fmt.Sprintf("metrics server: %v", err))
}
}()

return server
}
