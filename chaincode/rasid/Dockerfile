FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /rasid-chaincode .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

COPY --from=builder /rasid-chaincode /usr/local/bin/rasid-chaincode

EXPOSE 9999

ENTRYPOINT ["/usr/local/bin/rasid-chaincode"]
