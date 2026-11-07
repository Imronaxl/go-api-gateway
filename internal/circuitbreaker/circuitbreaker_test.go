package circuitbreaker

import (
	"sync"
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestBreaker(cfg Config) (*CircuitBreaker, *fakeClock) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	cb := New(cfg)
	cb.now = clock.now
	return cb, clock
}

func TestOpensAfterConsecutiveFailures(t *testing.T) {
	cb, _ := newTestBreaker(Config{MaxFailures: 3, OpenTimeout: time.Second})

	cb.RecordFailure()
	cb.RecordFailure()
	if got := cb.State(); got != StateClosed {
		t.Fatalf("after 2 failures: state = %v, want closed", got)
	}

	cb.RecordFailure()
	if got := cb.State(); got != StateOpen {
		t.Fatalf("after 3 failures: state = %v, want open", got)
	}
	if cb.Allow() {
		t.Fatal("open breaker admitted a request before the timeout")
	}
}

func TestSuccessResetsFailureCount(t *testing.T) {
	cb, _ := newTestBreaker(Config{MaxFailures: 2, OpenTimeout: time.Second})

	cb.RecordFailure()
	cb.RecordSuccess()
	cb.RecordFailure()

	if got := cb.State(); got != StateClosed {
		t.Fatalf("non-consecutive failures opened the breaker: state = %v", got)
	}
}

func TestHalfOpenAdmitsLimitedProbes(t *testing.T) {
	cb, clock := newTestBreaker(Config{MaxFailures: 1, OpenTimeout: time.Second, HalfOpenRequests: 2})
	cb.RecordFailure()

	clock.advance(time.Second)

	for i := 0; i < 2; i++ {
		if !cb.Allow() {
			t.Fatalf("half-open breaker rejected probe %d of 2", i+1)
		}
	}
	if got := cb.State(); got != StateHalfOpen {
		t.Fatalf("state = %v, want half-open", got)
	}
	if cb.Allow() {
		t.Fatal("half-open breaker admitted more probes than HalfOpenRequests")
	}
}

func TestHalfOpenClosesAfterSuccessfulProbes(t *testing.T) {
	cb, clock := newTestBreaker(Config{MaxFailures: 1, OpenTimeout: time.Second, HalfOpenRequests: 2})
	cb.RecordFailure()
	clock.advance(time.Second)

	cb.Allow()
	cb.RecordSuccess()
	if got := cb.State(); got != StateHalfOpen {
		t.Fatalf("closed after 1 of 2 probes: state = %v", got)
	}

	cb.Allow()
	cb.RecordSuccess()
	if got := cb.State(); got != StateClosed {
		t.Fatalf("state = %v, want closed", got)
	}
	if !cb.Allow() {
		t.Fatal("closed breaker rejected a request")
	}
}

func TestHalfOpenFailureReopens(t *testing.T) {
	cb, clock := newTestBreaker(Config{MaxFailures: 1, OpenTimeout: time.Second, HalfOpenRequests: 3})
	cb.RecordFailure()
	clock.advance(time.Second)

	cb.Allow()
	cb.RecordFailure()

	if got := cb.State(); got != StateOpen {
		t.Fatalf("state = %v, want open", got)
	}
	if cb.Allow() {
		t.Fatal("re-opened breaker admitted a request without waiting for the timeout")
	}

	clock.advance(time.Second)
	if !cb.Allow() {
		t.Fatal("breaker did not move to half-open after the second timeout")
	}
}

func TestOnStateChange(t *testing.T) {
	var transitions []string
	cb, clock := newTestBreaker(Config{
		MaxFailures:      1,
		OpenTimeout:      time.Second,
		HalfOpenRequests: 1,
		OnStateChange: func(from, to State) {
			transitions = append(transitions, from.String()+"->"+to.String())
		},
	})

	cb.RecordFailure()
	clock.advance(time.Second)
	cb.Allow()
	cb.RecordSuccess()

	want := []string{"closed->open", "open->half-open", "half-open->closed"}
	if len(transitions) != len(want) {
		t.Fatalf("transitions = %v, want %v", transitions, want)
	}
	for i := range want {
		if transitions[i] != want[i] {
			t.Fatalf("transitions = %v, want %v", transitions, want)
		}
	}
}

func TestConcurrentUse(t *testing.T) {
	cb := New(Config{MaxFailures: 50, OpenTimeout: time.Millisecond, HalfOpenRequests: 5})

	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for j := 0; j < 1000; j++ {
				if cb.Allow() {
					if (i+j)%3 == 0 {
						cb.RecordFailure()
					} else {
						cb.RecordSuccess()
					}
				}
				_ = cb.State()
			}
		}(i)
	}
	wg.Wait()
}
