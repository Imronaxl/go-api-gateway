FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o relay ./cmd/relay
RUN CGO_ENABLED=0 GOOS=linux go build -o rest-backend ./demo-backends/rest
RUN CGO_ENABLED=0 GOOS=linux go build -o grpc-backend ./demo-backends/grpc

FROM gcr.io/distroless/static-debian12

WORKDIR /app
COPY --from=builder /app/relay /app/relay
COPY --from=builder /app/rest-backend /app/rest-backend
COPY --from=builder /app/grpc-backend /app/grpc-backend

EXPOSE 8080 8081 8082 8083 9090

ENTRYPOINT ["/app/relay"]
