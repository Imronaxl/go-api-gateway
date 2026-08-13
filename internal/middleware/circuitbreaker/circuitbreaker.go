
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
MaxFailures   int           
Timeout       time.Duration 
HalfOpenLimit int           
}


type CircuitBreaker struct {
mu            sync.RWMutex
state         State
failures      int
successes     int
lastFailure   time.Time
halfOpenCount int
cfg           Config
}


func New(cfg Config) *CircuitBreaker {
if cfg.HalfOpenLimit == 0 {
cfg.HalfOpenLimit = 1
}
return &CircuitBreaker{
state: StateClosed,
cfg:   cfg,
}
}


func (cb *CircuitBreaker) State() State {
cb.mu.RLock()
defer cb.mu.RUnlock()

if cb.state == StateOpen {
if time.Since(cb.lastFailure) > cb.cfg.Timeout {
return StateHalfOpen
}
}
return cb.state
}


func (cb *CircuitBreaker) RecordSuccess() {
cb.mu.Lock()
defer cb.mu.Unlock()

switch cb.state {
case StateHalfOpen:
cb.successes++
if cb.successes >= cb.cfg.HalfOpenLimit {
cb.state = StateClosed
cb.failures = 0
cb.successes = 0
}
case StateClosed:
cb.failures = 0
}
}


func (cb *CircuitBreaker) RecordFailure() {
cb.mu.Lock()
defer cb.mu.Unlock()

cb.failures++
cb.lastFailure = time.Now()

switch cb.state {
case StateClosed:
if cb.failures >= cb.cfg.MaxFailures {
cb.state = StateOpen
}
case StateHalfOpen:
cb.state = StateOpen
cb.successes = 0
}
}


func (cb *CircuitBreaker) Allow() bool {
cb.mu.Lock()
defer cb.mu.Unlock()

switch cb.state {
case StateClosed:
return true
case StateOpen:
if time.Since(cb.lastFailure) > cb.cfg.Timeout {
cb.state = StateHalfOpen
cb.halfOpenCount = 0
return true
}
return false
case StateHalfOpen:
if cb.halfOpenCount < cb.cfg.HalfOpenLimit {
cb.halfOpenCount++
return true
}
return false
default:
return false
}
}
