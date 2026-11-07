// Command rest is a small upstream service for trying the gateway locally.
//
// Environment:
//
//	PORT        listen port (default 8081)
//	BACKEND_ID  name returned in responses (default "rest-<port>")
//	FAIL_RATE   fraction of /api requests answered with 500, e.g. 0.3
//	LATENCY     artificial delay added to /api requests, e.g. 20ms
package main

import (
	"encoding/json"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	port := envOr("PORT", "8081")
	id := envOr("BACKEND_ID", "rest-"+port)
	failRate, _ := strconv.ParseFloat(os.Getenv("FAIL_RATE"), 64)
	latency, _ := time.ParseDuration(os.Getenv("LATENCY"))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if latency > 0 {
			time.Sleep(latency)
		}
		if failRate > 0 && rand.Float64() < failRate {
			http.Error(w, "injected failure", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"backend": id,
			"method":  r.Method,
			"path":    r.URL.Path,
			"subject": r.Header.Get("X-Auth-Subject"),
		})
	})

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	logger.Info("backend listening", "id", id, "addr", srv.Addr, "fail_rate", failRate)
	if err := srv.ListenAndServe(); err != nil {
		logger.Error("backend stopped", "error", err)
		os.Exit(1)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
