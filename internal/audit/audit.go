package audit

import (
        "context"
        "encoding/json"
        "sync/atomic"

        "github.com/segmentio/kafka-go"
)

type Event struct {
        Type      string                 `json:"type"`
        Timestamp int64                  `json:"timestamp"`
        Data      map[string]interface{} `json:"data"`
}

type Publisher struct {
        writer      *kafka.Writer
        events      chan Event
        dropped     atomic.Uint64
}

type Config struct {
        Brokers    []string
        Topic      string
        BufferSize int
}

func NewPublisher(cfg Config) *Publisher {
        p := &Publisher{
                events: make(chan Event, cfg.BufferSize),
                writer: kafka.NewWriter(kafka.WriterConfig{
                        Brokers: cfg.Brokers,
                        Topic:   cfg.Topic,
                        Async:   true,
                }),
        }
        go p.process()
        return p
}

func (p *Publisher) Publish(ctx context.Context, event Event) bool {
        select {
        case p.events <- event:
                return true
        default:
                p.dropped.Add(1)
                return false
        }
}

func (p *Publisher) process() {
        for event := range p.events {
                data, _ := json.Marshal(event)
                p.writer.WriteMessages(context.Background(),
                        kafka.Message{Value: data},
                )
        }
}

func (p *Publisher) Close() error {
        close(p.events)
        return p.writer.Close()
}

func (p *Publisher) DroppedCount() uint64 {
        return p.dropped.Load()
}
