// Package auth verifies HS256-signed JWTs from the Authorization header.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/httpx"
)

var (
	ErrMissingToken     = errors.New("missing bearer token")
	ErrMalformedToken   = errors.New("malformed token")
	ErrUnsupportedAlg   = errors.New("unsupported signing algorithm")
	ErrInvalidSignature = errors.New("invalid signature")
	ErrExpired          = errors.New("token expired")
	ErrNotYetValid      = errors.New("token not yet valid")
)

type Config struct {
	Secret []byte
	// Leeway tolerates small clock differences when checking exp and nbf.
	Leeway time.Duration
	// OnReject, if set, is called with the reason a request was rejected.
	OnReject func(reason error)
}

// Claims holds the registered claims the gateway cares about.
type Claims struct {
	Subject   string `json:"sub"`
	ExpiresAt *int64 `json:"exp,omitempty"`
	NotBefore *int64 `json:"nbf,omitempty"`
	IssuedAt  *int64 `json:"iat,omitempty"`
}

type header struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

type Verifier struct {
	cfg Config
	now func() time.Time
}

func NewVerifier(cfg Config) *Verifier {
	return &Verifier{cfg: cfg, now: time.Now}
}

// Verify checks the token signature and time-based claims.
func (v *Verifier) Verify(token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, ErrMalformedToken
	}

	var h header
	if err := decodeSegment(parts[0], &h); err != nil {
		return Claims{}, ErrMalformedToken
	}
	// Only HS256 is accepted. In particular "none" and asymmetric algorithms
	// are rejected so a client cannot choose how its own token is checked.
	if h.Alg != "HS256" {
		return Claims{}, ErrUnsupportedAlg
	}

	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return Claims{}, ErrMalformedToken
	}
	mac := hmac.New(sha256.New, v.cfg.Secret)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return Claims{}, ErrInvalidSignature
	}

	var c Claims
	if err := decodeSegment(parts[1], &c); err != nil {
		return Claims{}, ErrMalformedToken
	}

	now := v.now()
	if c.ExpiresAt != nil && now.After(time.Unix(*c.ExpiresAt, 0).Add(v.cfg.Leeway)) {
		return Claims{}, ErrExpired
	}
	if c.NotBefore != nil && now.Add(v.cfg.Leeway).Before(time.Unix(*c.NotBefore, 0)) {
		return Claims{}, ErrNotYetValid
	}
	return c, nil
}

// Sign creates an HS256 token for the given claims. It is used by the
// tokengen command and in tests.
func Sign(secret []byte, c Claims) (string, error) {
	h, err := json.Marshal(header{Alg: "HS256", Typ: "JWT"})
	if err != nil {
		return "", err
	}
	p, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	signingInput := base64.RawURLEncoding.EncodeToString(h) + "." + base64.RawURLEncoding.EncodeToString(p)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

// Middleware rejects requests without a valid bearer token with 401 and
// stores the token subject in the request context.
func (v *Verifier) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r.Header.Get("Authorization"))
		if !ok {
			v.reject(w, ErrMissingToken)
			return
		}
		claims, err := v.Verify(token)
		if err != nil {
			v.reject(w, err)
			return
		}
		if info := httpx.InfoFrom(r.Context()); info != nil {
			info.Subject = claims.Subject
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), subjectKey{}, claims.Subject)))
	})
}

func (v *Verifier) reject(w http.ResponseWriter, reason error) {
	if v.cfg.OnReject != nil {
		v.cfg.OnReject(reason)
	}
	w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
	http.Error(w, reason.Error(), http.StatusUnauthorized)
}

type subjectKey struct{}

// Subject returns the authenticated subject, or "" for anonymous requests.
func Subject(ctx context.Context) string {
	s, _ := ctx.Value(subjectKey{}).(string)
	return s
}

func bearerToken(h string) (string, bool) {
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", false
	}
	return strings.TrimSpace(h[len(prefix):]), true
}

func decodeSegment(seg string, v any) error {
	b, err := base64.RawURLEncoding.DecodeString(seg)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}
