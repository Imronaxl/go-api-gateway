package cors

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	reached := false
	h := Middleware([]string{"http://localhost:3000"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
	}))

	t.Run("preflight is answered without reaching the handler", func(t *testing.T) {
		reached = false
		req := httptest.NewRequest(http.MethodOptions, "/x", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "POST")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent || reached {
			t.Fatalf("status = %d, reached = %v", rec.Code, reached)
		}
		if rec.Header().Get("Access-Control-Allow-Headers") == "" {
			t.Fatal("missing Access-Control-Allow-Headers")
		}
	})

	t.Run("preflight allows requested headers", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/x", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "GET")
		req.Header.Set("Access-Control-Request-Headers", "authorization, x-request-id")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if got := rec.Header().Get("Access-Control-Allow-Headers"); got != "authorization, x-request-id" {
			t.Fatalf("Access-Control-Allow-Headers = %q", got)
		}
	})

	t.Run("allowed origin gets exposed headers", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
			t.Fatal("origin not allowed")
		}
		if rec.Header().Get("Access-Control-Expose-Headers") == "" {
			t.Fatal("missing Access-Control-Expose-Headers")
		}
	})

	t.Run("other origins get no CORS headers", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.Header.Set("Origin", "http://evil.example")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatal("unlisted origin was allowed")
		}
	})
}
