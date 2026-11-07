package auth

import (
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var secret = []byte("test-secret")

func ptr(v int64) *int64 { return &v }

func mustSign(t *testing.T, key []byte, c Claims) string {
	t.Helper()
	tok, err := Sign(key, c)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func newVerifier(now time.Time) *Verifier {
	v := NewVerifier(Config{Secret: secret, Leeway: 5 * time.Second})
	v.now = func() time.Time { return now }
	return v
}

func TestVerify(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	noneHeader := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	valid := mustSign(t, secret, Claims{Subject: "alice", ExpiresAt: ptr(now.Unix() + 60)})
	payload := strings.Split(valid, ".")[1]

	tests := []struct {
		name    string
		token   string
		wantErr error
	}{
		{"valid", valid, nil},
		{"no exp claim", mustSign(t, secret, Claims{Subject: "alice"}), nil},
		{"wrong secret", mustSign(t, []byte("other"), Claims{Subject: "alice"}), ErrInvalidSignature},
		{"expired", mustSign(t, secret, Claims{ExpiresAt: ptr(now.Unix() - 60)}), ErrExpired},
		{"expired within leeway", mustSign(t, secret, Claims{ExpiresAt: ptr(now.Unix() - 3)}), nil},
		{"not yet valid", mustSign(t, secret, Claims{NotBefore: ptr(now.Unix() + 60)}), ErrNotYetValid},
		{"alg none", noneHeader + "." + payload + ".", ErrUnsupportedAlg},
		{"two segments", "abc.def", ErrMalformedToken},
		{"garbage header", "!!!." + payload + ".sig", ErrMalformedToken},
		{"tampered payload", strings.Replace(valid, payload, base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"admin"}`)), 1), ErrInvalidSignature},
	}

	v := newVerifier(now)
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := v.Verify(tc.token)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Verify() error = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestMiddleware(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	var rejected []error
	v := newVerifier(now)
	v.cfg.OnReject = func(err error) { rejected = append(rejected, err) }

	var gotSubject string
	h := v.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSubject = Subject(r.Context())
	}))

	t.Run("valid token reaches handler", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+mustSign(t, secret, Claims{Subject: "alice"}))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if gotSubject != "alice" {
			t.Fatalf("subject = %q, want alice", gotSubject)
		}
	})

	for _, hdr := range []string{"", "Bearer", "Basic dXNlcjpwYXNz", "Bearer not-a-jwt"} {
		t.Run("rejects "+hdr, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if hdr != "" {
				req.Header.Set("Authorization", hdr)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", rec.Code)
			}
			if rec.Header().Get("WWW-Authenticate") == "" {
				t.Fatal("missing WWW-Authenticate header")
			}
		})
	}

	if len(rejected) != 4 {
		t.Fatalf("OnReject called %d times, want 4", len(rejected))
	}
}
