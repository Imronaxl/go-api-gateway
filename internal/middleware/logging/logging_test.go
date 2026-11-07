package logging

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
)

func TestLogLine(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	h := Middleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info := httpx.InfoFrom(r.Context())
		info.Subject = "alice"
		info.TraceID = "abc123"
		w.Header().Set(metrics.BackendHeader, "b1")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("oops"))
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/orders", nil))

	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("log line is not JSON: %v (%s)", err, buf.String())
	}

	want := map[string]any{
		"level":    "ERROR",
		"msg":      "request",
		"method":   "GET",
		"path":     "/orders",
		"status":   float64(502),
		"bytes":    float64(4),
		"backend":  "b1",
		"subject":  "alice",
		"trace_id": "abc123",
	}
	for k, v := range want {
		if line[k] != v {
			t.Errorf("%s = %v, want %v", k, line[k], v)
		}
	}
	if _, ok := line["duration_ms"]; !ok {
		t.Error("duration_ms is missing")
	}
}
