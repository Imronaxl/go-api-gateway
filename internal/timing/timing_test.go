package timing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestServerTimingHeader(t *testing.T) {
	clock := time.Unix(0, 0)
	now := func() time.Time { return clock }
	tick := func(ms int) { clock = clock.Add(time.Duration(ms) * time.Millisecond) }

	h := middleware(now)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tick(1)
		Mark(r.Context(), "auth")
		tick(2)
		Mark(r.Context(), "upstream")
		tick(10)
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	want := "auth;dur=2.000, upstream;dur=10.000, total;dur=13.000"
	if got := rec.Header().Get("Server-Timing"); got != want {
		t.Fatalf("Server-Timing = %q, want %q", got, want)
	}
}

func TestMarkWithoutMiddleware(t *testing.T) {
	Mark(context.Background(), "auth") // must not panic
}
