// Package audit provides async Kafka audit logging.
package audit

import (
"context"
"encoding/json"
"sync/atomic"

"github.com/segmentio/kafka-go"
)

// Event represents an audit log event.
type Event struct {
Type      string                 `json:"type"`
Timestamp int64                  `json:"timestamp"`
Data      map[string]interface{} `json:"data"`
}

// Publisher publishes audit events to Kafka asynchronously.
type Publisher struct {
writer      *kafka.Writer
events      chan Event
dropped     atomic.Uint64
writeTicker *kafka.Writer
}

// Config holds audit publisher configuration.
type Config struct {
Brokers   []string
Topic     string
BufferSize int
}

// NewPublisher creates a new audit event publisher.
func NewPublisher(cfg Config) *Publisher {
p := &Publisher{
events: make(chan Event, cfg.BufferSize),
writer: kafka.NewWriter(kafka.WriterConfig{
Brokers:  cfg.Brokers,
Topic:    cfg.Topic,
Async:    true,
}),
}
go p.process()
return p
}

// Publish sends an audit event asynchronously.
func (p *Publisher) Publish(ctx context.Context, event Event) bool {
select {
case p.events <- event:
return true
default:
p.dropped.Add(1)
return false
}
}

// process handles event publishing in background.
func (p *Publisher) process() {
for event := range p.events {
data, _ := json.Marshal(event)
p.writer.WriteMessages(context.Background(),
kafka.Message{Value: data},
)
}
}

// Close closes the publisher.
func (p *Publisher) Close() error {
close(p.events)
return p.writer.Close()
}

// DroppedCount returns number of dropped events.
func (p *Publisher) DroppedCount() uint64 {
return p.dropped.Load()
}
