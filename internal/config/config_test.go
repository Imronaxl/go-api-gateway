package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestDefaults(t *testing.T) {
	c, err := Load(env(map[string]string{
		"RELAY_BACKENDS":   "http://a:8081, http://b:8082 ,",
		"RELAY_JWT_SECRET": "0123456789abcdef",
	}))
	if err != nil {
		t.Fatal(err)
	}

	if len(c.Backends) != 2 || c.Backends[1] != "http://b:8082" {
		t.Fatalf("Backends = %q", c.Backends)
	}
	if c.ListenAddr != ":8080" || c.RateLimitRPS != 100 || c.BreakerOpenTimeout != 30*time.Second {
		t.Fatalf("unexpected defaults: %+v", c)
	}
	if len(c.KafkaBrokers) != 0 {
		t.Fatal("Kafka should be disabled by default")
	}
}

func TestOverrides(t *testing.T) {
	c, err := Load(env(map[string]string{
		"RELAY_BACKENDS":             "http://a:1",
		"RELAY_JWT_SECRET":           "0123456789abcdef",
		"RELAY_RATE_LIMIT_RPS":       "2.5",
		"RELAY_BREAKER_OPEN_TIMEOUT": "750ms",
		"RELAY_TRUST_FORWARDED_FOR":  "true",
		"RELAY_CORS_ORIGINS":         "http://localhost:3000",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if c.RateLimitRPS != 2.5 || c.BreakerOpenTimeout != 750*time.Millisecond || !c.TrustForwardedFor {
		t.Fatalf("overrides not applied: %+v", c)
	}
	if len(c.CORSOrigins) != 1 {
		t.Fatalf("CORSOrigins = %q", c.CORSOrigins)
	}
}

func TestReportsAllErrors(t *testing.T) {
	_, err := Load(env(map[string]string{
		"RELAY_JWT_SECRET":       "short",
		"RELAY_RATE_LIMIT_BURST": "lots",
		"RELAY_HEALTH_INTERVAL":  "5",
	}))
	if err == nil {
		t.Fatal("expected an error")
	}
	for _, want := range []string{"RELAY_BACKENDS", "RELAY_JWT_SECRET", "RELAY_RATE_LIMIT_BURST", "RELAY_HEALTH_INTERVAL"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error does not mention %s: %v", want, err)
		}
	}
}
