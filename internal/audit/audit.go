// Package audit publishes one event per request to Kafka. Publishing is
// asynchronous and never blocks a request: when the buffer is full, events
// are dropped and counted.
package audit

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/segmentio/kafka-go"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
	"github.com/Imronaxl/go-api-gateway/internal/metrics"
)

type Event struct {
	Time       time.Time `json:"time"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Status     int       `json:"status"`
	Backend    string    `json:"backend,omitempty"`
	Subject    string    `json:"subject,omitempty"`
	TraceID    string    `json:"trace_id,omitempty"`
	DurationMS float64   `json:"duration_ms"`
}

type writer interface {
	WriteMessages(ctx context.Context, msgs ...kafka.Message) error
	Close() error
}

type Config struct {
	Brokers    []string
	Topic      string
	BufferSize int
}

type Publisher struct {
	w       writer
	events  chan Event
	done    chan struct{}
	dropped atomic.Uint64

	mu     sync.RWMutex
	closed bool
}

func NewPublisher(cfg Config) *Publisher {
	return newPublisher(&kafka.Writer{
		Addr:                   kafka.TCP(cfg.Brokers...),
		Topic:                  cfg.Topic,
		Balancer:               &kafka.LeastBytes{},
		BatchTimeout:           100 * time.Millisecond,
		AllowAutoTopicCreation: true,
	}, cfg.BufferSize)
}

func newPublisher(w writer, bufferSize int) *Publisher {
	if bufferSize <= 0 {
		bufferSize = 1024
	}
	p := &Publisher{
		w:      w,
		events: make(chan Event, bufferSize),
		done:   make(chan struct{}),
	}
	go p.run()
	return p
}

// Publish enqueues an event and reports whether it was accepted.
func (p *Publisher) Publish(e Event) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.closed {
		p.dropped.Add(1)
		return false
	}
	select {
	case p.events <- e:
		return true
	default:
		p.dropped.Add(1)
		return false
	}
}

func (p *Publisher) run() {
	defer close(p.done)
	for e := range p.events {
		data, err := json.Marshal(e)
		if err != nil {
			p.dropped.Add(1)
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := p.w.WriteMessages(ctx, kafka.Message{Value: data}); err != nil {
			p.dropped.Add(1)
		}
		cancel()
	}
}

// Close stops accepting events, flushes the buffer and closes the writer.
func (p *Publisher) Close() error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil
	}
	p.closed = true
	close(p.events)
	p.mu.Unlock()

	<-p.done
	return p.w.Close()
}

func (p *Publisher) Dropped() uint64 { return p.dropped.Load() }

// Middleware publishes an event after each request completes.
func (p *Publisher) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ctx, info := httpx.WithInfo(r.Context())
		rw := httpx.Wrap(w)

		next.ServeHTTP(rw, r.WithContext(ctx))

		p.Publish(Event{
			Time:       start.UTC(),
			Method:     r.Method,
			Path:       r.URL.Path,
			Status:     rw.Status(),
			Backend:    rw.Header().Get(metrics.BackendHeader),
			Subject:    info.Subject,
			TraceID:    info.TraceID,
			DurationMS: float64(time.Since(start).Microseconds()) / 1000,
		})
	})
}
