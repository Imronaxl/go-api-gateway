package httpx

import "context"

// Info is filled in by inner middleware (auth, tracing) so that outer
// middleware (logging, audit) can report it after the request is served.
type Info struct {
	Subject string
	TraceID string
}

type infoKey struct{}

// WithInfo attaches a fresh Info to ctx, or returns ctx unchanged if it
// already has one.
func WithInfo(ctx context.Context) (context.Context, *Info) {
	if info, ok := ctx.Value(infoKey{}).(*Info); ok {
		return ctx, info
	}
	info := &Info{}
	return context.WithValue(ctx, infoKey{}, info), info
}

// InfoFrom returns the request's Info, or nil if none was attached.
func InfoFrom(ctx context.Context) *Info {
	info, _ := ctx.Value(infoKey{}).(*Info)
	return info
}
