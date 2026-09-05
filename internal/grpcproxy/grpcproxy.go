package grpcproxy

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

type Proxy struct {
	conn *grpc.ClientConn
}

func NewProxy(target string) (*Proxy, error) {
	conn, err := grpc.Dial(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &Proxy{conn: conn}, nil
}

func (p *Proxy) Close() error {
	return p.conn.Close()
}

func (p *Proxy) Unary(ctx context.Context, method string, req, resp interface{}, opts ...grpc.CallOption) error {
	md, ok := metadata.FromIncomingContext(ctx)
	if ok {
		ctx = metadata.NewOutgoingContext(ctx, md)
	}
	return p.conn.Invoke(ctx, method, req, resp, opts...)
}
