// Package timing measures how long each gateway stage takes for a request
// and reports it in the Server-Timing response header.
//
// Middleware calls Mark when its stage starts. A stage lasts until the next
// mark, and the last one until the response headers are written, so for the
// "upstream" stage that is the time to the upstream's first byte.
package timing

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
)

type mark struct {
	name string
	at   time.Time
}

type recorder struct {
	start time.Time
	marks []mark
	now   func() time.Time
}

type ctxKey struct{}

// Middleware must be the outermost layer that should be included in "total".
func Middleware(next http.Handler) http.Handler {
	return middleware(time.Now)(next)
}

func middleware(now func() time.Time) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &recorder{start: now(), now: now}
			rw := httpx.Wrap(w)
			rw.BeforeWriteHeader(func(h http.Header) {
				h.Set("Server-Timing", rec.header(rec.now()))
			})
			next.ServeHTTP(rw, r.WithContext(context.WithValue(r.Context(), ctxKey{}, rec)))
		})
	}
}

// Mark records the start of a stage. It is a no-op outside Middleware.
func Mark(ctx context.Context, stage string) {
	if rec, ok := ctx.Value(ctxKey{}).(*recorder); ok {
		rec.marks = append(rec.marks, mark{name: stage, at: rec.now()})
	}
}

func (r *recorder) header(end time.Time) string {
	parts := make([]string, 0, len(r.marks)+1)
	for i, m := range r.marks {
		until := end
		if i+1 < len(r.marks) {
			until = r.marks[i+1].at
		}
		parts = append(parts, entry(m.name, until.Sub(m.at)))
	}
	parts = append(parts, entry("total", end.Sub(r.start)))
	return strings.Join(parts, ", ")
}

func entry(name string, d time.Duration) string {
	return fmt.Sprintf("%s;dur=%.3f", name, float64(d.Microseconds())/1000)
}
