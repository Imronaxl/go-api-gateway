package tracing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
)

func TestSpanContinuesIncomingTrace(t *testing.T) {
	exporter := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(sdktrace.WithSyncer(exporter))
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

	const parentTrace = "4bf92f3577b34da6a3ce929d0e0e4736"
	var innerTrace string
	h := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		innerTrace = trace.SpanContextFromContext(r.Context()).TraceID().String()
		w.WriteHeader(http.StatusServiceUnavailable)
	}))

	ctx, info := httpx.WithInfo(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/orders", nil).WithContext(ctx)
	req.Header.Set("traceparent", "00-"+parentTrace+"-00f067aa0ba902b7-01")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if innerTrace != parentTrace {
		t.Fatalf("handler trace = %s, want %s", innerTrace, parentTrace)
	}
	if got := rec.Header().Get(TraceHeader); got != parentTrace {
		t.Fatalf("%s = %q, want %s", TraceHeader, got, parentTrace)
	}
	if info.TraceID != parentTrace {
		t.Fatalf("Info.TraceID = %q", info.TraceID)
	}

	spans := exporter.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("exported %d spans, want 1", len(spans))
	}
	if spans[0].Name != "GET /orders" || spans[0].SpanKind != trace.SpanKindServer {
		t.Fatalf("span = %s (%v)", spans[0].Name, spans[0].SpanKind)
	}
	if spans[0].Status.Code.String() != "Error" {
		t.Fatalf("span status = %v, want Error for a 503", spans[0].Status.Code)
	}
}
