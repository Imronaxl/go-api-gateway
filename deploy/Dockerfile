FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY demo-backends ./demo-backends
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/relay ./cmd/relay \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/tokengen ./cmd/tokengen \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/rest-backend ./demo-backends/rest

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ /app/
USER nonroot
EXPOSE 8080 9090
ENTRYPOINT ["/app/relay"]
