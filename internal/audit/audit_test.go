package audit

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/segmentio/kafka-go"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
)

type fakeWriter struct {
	mu     sync.Mutex
	msgs   []kafka.Message
	block  chan struct{}
	err    error
	closed bool
}

func (f *fakeWriter) WriteMessages(_ context.Context, msgs ...kafka.Message) error {
	if f.block != nil {
		<-f.block
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.msgs = append(f.msgs, msgs...)
	return f.err
}

func (f *fakeWriter) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = true
	return nil
}

func TestCloseFlushesBufferedEvents(t *testing.T) {
	w := &fakeWriter{}
	p := newPublisher(w, 10)
	for i := 0; i < 5; i++ {
		p.Publish(Event{Path: "/x"})
	}
	if err := p.Close(); err != nil {
		t.Fatal(err)
	}

	if len(w.msgs) != 5 || !w.closed {
		t.Fatalf("wrote %d messages, closed = %v; want 5, true", len(w.msgs), w.closed)
	}
	if p.Publish(Event{}) {
		t.Fatal("Publish after Close was accepted")
	}
	if err := p.Close(); err != nil {
		t.Fatal("second Close returned an error")
	}
}

func TestFullBufferDropsInsteadOfBlocking(t *testing.T) {
	w := &fakeWriter{block: make(chan struct{})}
	p := newPublisher(w, 2)

	accepted := 0
	for i := 0; i < 10; i++ {
		if p.Publish(Event{}) {
			accepted++
		}
	}
	close(w.block)
	_ = p.Close()

	// One event may already be in flight in the writer, plus two buffered.
	if accepted > 3 || p.Dropped() < 7 {
		t.Fatalf("accepted %d, dropped %d", accepted, p.Dropped())
	}
}

func TestWriteErrorsAreCounted(t *testing.T) {
	p := newPublisher(&fakeWriter{err: errors.New("broker down")}, 4)
	p.Publish(Event{})
	_ = p.Close()

	if p.Dropped() != 1 {
		t.Fatalf("Dropped() = %d, want 1", p.Dropped())
	}
}

func TestMiddleware(t *testing.T) {
	w := &fakeWriter{}
	p := newPublisher(w, 4)

	h := p.Middleware(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		httpx.InfoFrom(r.Context()).Subject = "alice"
		rw.Header().Set("X-Backend-Id", "b1")
		rw.WriteHeader(http.StatusCreated)
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/orders", nil))
	_ = p.Close()

	if len(w.msgs) != 1 {
		t.Fatalf("wrote %d messages, want 1", len(w.msgs))
	}
	var e Event
	if err := json.Unmarshal(w.msgs[0].Value, &e); err != nil {
		t.Fatal(err)
	}
	if e.Method != "POST" || e.Path != "/orders" || e.Status != 201 || e.Backend != "b1" || e.Subject != "alice" {
		t.Fatalf("unexpected event %+v", e)
	}
}
