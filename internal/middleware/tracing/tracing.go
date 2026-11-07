// Package tracing starts an OpenTelemetry server span for every request.
package tracing

import (
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
)

// TraceHeader returns the trace ID to the client so a request can be found
// in the tracing backend.
const TraceHeader = "X-Trace-Id"

func Middleware(next http.Handler) http.Handler {
	tracer := otel.Tracer("github.com/Imronaxl/go-api-gateway")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
		ctx, span := tracer.Start(ctx, r.Method+" "+r.URL.Path,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				attribute.String("http.request.method", r.Method),
				attribute.String("url.path", r.URL.Path),
			),
		)
		defer span.End()

		if sc := span.SpanContext(); sc.IsValid() {
			w.Header().Set(TraceHeader, sc.TraceID().String())
			if info := httpx.InfoFrom(ctx); info != nil {
				info.TraceID = sc.TraceID().String()
			}
		}

		rw := httpx.Wrap(w)
		next.ServeHTTP(rw, r.WithContext(ctx))

		span.SetAttributes(attribute.Int("http.response.status_code", rw.Status()))
		if rw.Status() >= http.StatusInternalServerError {
			span.SetStatus(codes.Error, http.StatusText(rw.Status()))
		}
	})
}
