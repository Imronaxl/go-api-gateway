// Package tracing provides OpenTelemetry tracing middleware.
package tracing

import (
"net/http"

"go.opentelemetry.io/otel"
"go.opentelemetry.io/otel/propagation"
"go.opentelemetry.io/otel/trace"
)

// Middleware creates OpenTelemetry tracing middleware.
func Middleware() func(http.Handler) http.Handler {
tracer := otel.Tracer("relay")
propagator := otel.GetTextMapPropagator()

return func(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
ctx := propagator.Extract(r.Context(), propagation.HeaderCarrier(r.Header))
ctx, span := tracer.Start(ctx, "relay-request", trace.WithSpanKind(trace.SpanKindServer))
defer span.End()

next.ServeHTTP(w, r.WithContext(ctx))
})
}
}
