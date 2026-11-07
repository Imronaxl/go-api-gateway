// Package circuitbreaker implements a three-state circuit breaker
// (closed -> open -> half-open -> closed) that guards a single upstream.
package circuitbreaker

import (
	"sync"
	"time"
)

type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

type Config struct {
	// MaxFailures is the number of consecutive failures that opens the breaker.
	MaxFailures int
	// OpenTimeout is how long the breaker stays open before letting probes through.
	OpenTimeout time.Duration
	// HalfOpenRequests is how many probe requests are admitted in half-open state;
	// the breaker closes once all of them succeed.
	HalfOpenRequests int
	// OnStateChange, if set, is called after every transition. It must not block.
	OnStateChange func(from, to State)
}

type CircuitBreaker struct {
	mu        sync.Mutex
	cfg       Config
	state     State
	failures  int
	successes int
	admitted  int
	openedAt  time.Time
	now       func() time.Time
}

func New(cfg Config) *CircuitBreaker {
	if cfg.MaxFailures <= 0 {
		cfg.MaxFailures = 1
	}
	if cfg.HalfOpenRequests <= 0 {
		cfg.HalfOpenRequests = 1
	}
	return &CircuitBreaker{cfg: cfg, state: StateClosed, now: time.Now}
}

// State returns the current state without changing it. An open breaker whose
// timeout has elapsed is still reported as open until the next Allow call.
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

// Allow reports whether a request may be sent to the upstream. In half-open
// state it admits at most HalfOpenRequests probes.
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	from := cb.state
	allowed := false

	switch cb.state {
	case StateClosed:
		allowed = true
	case StateOpen:
		if cb.now().Sub(cb.openedAt) >= cb.cfg.OpenTimeout {
			cb.state = StateHalfOpen
			cb.successes = 0
			cb.admitted = 1
			allowed = true
		}
	case StateHalfOpen:
		if cb.admitted < cb.cfg.HalfOpenRequests {
			cb.admitted++
			allowed = true
		}
	}

	to := cb.state
	cb.mu.Unlock()
	cb.notify(from, to)
	return allowed
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	from := cb.state

	switch cb.state {
	case StateClosed:
		cb.failures = 0
	case StateHalfOpen:
		cb.successes++
		if cb.successes >= cb.cfg.HalfOpenRequests {
			cb.state = StateClosed
			cb.failures = 0
		}
	}

	to := cb.state
	cb.mu.Unlock()
	cb.notify(from, to)
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	from := cb.state

	switch cb.state {
	case StateClosed:
		cb.failures++
		if cb.failures >= cb.cfg.MaxFailures {
			cb.trip()
		}
	case StateHalfOpen:
		cb.trip()
	}

	to := cb.state
	cb.mu.Unlock()
	cb.notify(from, to)
}

// trip moves the breaker to open. Caller must hold mu.
func (cb *CircuitBreaker) trip() {
	cb.state = StateOpen
	cb.openedAt = cb.now()
	cb.failures = 0
	cb.successes = 0
	cb.admitted = 0
}

func (cb *CircuitBreaker) notify(from, to State) {
	if from != to && cb.cfg.OnStateChange != nil {
		cb.cfg.OnStateChange(from, to)
	}
}
