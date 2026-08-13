package main

import (
"log/slog"
"net"
"os"

"google.golang.org/grpc"
)

func main() {
logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

srv := grpc.NewServer()
lis, err := net.Listen("tcp", ":8083")
if err != nil {
logger.Error("listen failed", "error", err)
os.Exit(1)
}

logger.Info("grpc backend starting", "addr", ":8083")
if err := srv.Serve(lis); err != nil {
logger.Error("serve failed", "error", err)
os.Exit(1)
}
}
