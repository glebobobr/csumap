FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM golang:1.24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY --from=frontend /app/dist ./dist
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o csumap ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./cmd/migrate
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o importdata ./cmd/importdata

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata postgresql-client
WORKDIR /app
COPY --from=builder /app/csumap .
COPY --from=builder /app/migrate .
COPY --from=builder /app/importdata .
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]