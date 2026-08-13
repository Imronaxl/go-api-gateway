// Package grpcproxy provides gRPC proxying functionality.
package grpcproxy

import (
"context"

"google.golang.org/grpc"
"google.golang.org/grpc/metadata"
)

// Proxy handles gRPC request proxying.
type Proxy struct {
conn *grpc.ClientConn
}

// NewProxy creates a new gRPC proxy.
func NewProxy(target string) (*Proxy, error) {
conn, err := grpc.NewClient(target, grpc.WithInsecure())
if err != nil {
return nil, err
}
return &Proxy{conn: conn}, nil
}

// Close closes the proxy connection.
func (p *Proxy) Close() error {
return p.conn.Close()
}

// Unary proxies a unary gRPC call.
func (p *Proxy) Unary(ctx context.Context, method string, req, resp interface{}, opts ...grpc.CallOption) error {
md, ok := metadata.FromIncomingContext(ctx)
if ok {
ctx = metadata.NewOutgoingContext(ctx, md)
}
return p.conn.Invoke(ctx, method, req, resp, opts...)
}
