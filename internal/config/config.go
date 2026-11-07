// Package config reads gateway settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ListenAddr  string
	MetricsAddr string

	Backends        []string
	UpstreamTimeout time.Duration
	HealthPath      string
	HealthInterval  time.Duration

	JWTSecret string

	RateLimitRPS      float64
	RateLimitBurst    int
	TrustForwardedFor bool

	BreakerMaxFailures      int
	BreakerOpenTimeout      time.Duration
	BreakerHalfOpenRequests int

	CORSOrigins []string

	KafkaBrokers []string
	KafkaTopic   string
}

// Load reads the configuration using getenv (os.Getenv in production) and
// reports every invalid or missing value at once.
func Load(getenv func(string) string) (Config, error) {
	p := parser{getenv: getenv}

	c := Config{
		ListenAddr:  p.str("RELAY_LISTEN_ADDR", ":8080"),
		MetricsAddr: p.str("RELAY_METRICS_ADDR", ":9090"),

		Backends:        p.list("RELAY_BACKENDS"),
		UpstreamTimeout: p.duration("RELAY_UPSTREAM_TIMEOUT", 30*time.Second),
		HealthPath:      p.str("RELAY_HEALTH_PATH", "/health"),
		HealthInterval:  p.duration("RELAY_HEALTH_INTERVAL", 5*time.Second),

		JWTSecret: p.str("RELAY_JWT_SECRET", ""),

		RateLimitRPS:      p.float("RELAY_RATE_LIMIT_RPS", 100),
		RateLimitBurst:    p.int("RELAY_RATE_LIMIT_BURST", 50),
		TrustForwardedFor: p.bool("RELAY_TRUST_FORWARDED_FOR", false),

		BreakerMaxFailures:      p.int("RELAY_BREAKER_MAX_FAILURES", 5),
		BreakerOpenTimeout:      p.duration("RELAY_BREAKER_OPEN_TIMEOUT", 30*time.Second),
		BreakerHalfOpenRequests: p.int("RELAY_BREAKER_HALF_OPEN_REQUESTS", 3),

		CORSOrigins: p.list("RELAY_CORS_ORIGINS"),

		KafkaBrokers: p.list("RELAY_KAFKA_BROKERS"),
		KafkaTopic:   p.str("RELAY_KAFKA_TOPIC", "relay.audit"),
	}

	if len(c.Backends) == 0 {
		p.fail("RELAY_BACKENDS is required")
	}
	if len(c.JWTSecret) < 16 {
		p.fail("RELAY_JWT_SECRET must be at least 16 characters")
	}
	if c.RateLimitRPS <= 0 || c.RateLimitBurst <= 0 {
		p.fail("rate limit RPS and burst must be positive")
	}

	return c, errors.Join(p.errs...)
}

type parser struct {
	getenv func(string) string
	errs   []error
}

func (p *parser) fail(format string, args ...any) {
	p.errs = append(p.errs, fmt.Errorf(format, args...))
}

func (p *parser) str(key, def string) string {
	if v := strings.TrimSpace(p.getenv(key)); v != "" {
		return v
	}
	return def
}

func (p *parser) list(key string) []string {
	var out []string
	for _, s := range strings.Split(p.getenv(key), ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func (p *parser) int(key string, def int) int {
	v := p.str(key, "")
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		p.fail("%s: %q is not an integer", key, v)
		return def
	}
	return n
}

func (p *parser) float(key string, def float64) float64 {
	v := p.str(key, "")
	if v == "" {
		return def
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		p.fail("%s: %q is not a number", key, v)
		return def
	}
	return f
}

func (p *parser) bool(key string, def bool) bool {
	v := p.str(key, "")
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		p.fail("%s: %q is not a boolean", key, v)
		return def
	}
	return b
}

func (p *parser) duration(key string, def time.Duration) time.Duration {
	v := p.str(key, "")
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		p.fail("%s: %q is not a duration (use e.g. 500ms, 30s)", key, v)
		return def
	}
	return d
}

// FromEnv loads the configuration from the process environment.
func FromEnv() (Config, error) { return Load(os.Getenv) }
