// Command tokengen prints an HS256 JWT for local testing.
//
//	go run ./cmd/tokengen -secret "$RELAY_JWT_SECRET" -sub alice -ttl 1h
package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/Imronaxl/go-api-gateway/internal/middleware/auth"
)

func main() {
	secret := flag.String("secret", os.Getenv("RELAY_JWT_SECRET"), "HMAC secret (defaults to $RELAY_JWT_SECRET)")
	sub := flag.String("sub", "demo-user", "subject claim")
	ttl := flag.Duration("ttl", time.Hour, "token lifetime; 0 for no expiry")
	flag.Parse()

	if *secret == "" {
		fmt.Fprintln(os.Stderr, "tokengen: -secret or RELAY_JWT_SECRET is required")
		os.Exit(2)
	}

	now := time.Now().Unix()
	claims := auth.Claims{Subject: *sub, IssuedAt: &now}
	if *ttl > 0 {
		exp := time.Now().Add(*ttl).Unix()
		claims.ExpiresAt = &exp
	}

	tok, err := auth.Sign([]byte(*secret), claims)
	if err != nil {
		fmt.Fprintln(os.Stderr, "tokengen:", err)
		os.Exit(1)
	}
	fmt.Println(tok)
}
