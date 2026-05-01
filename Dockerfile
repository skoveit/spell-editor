FROM golang:1.20-alpine AS builder

RUN apk add --no-cache curl

WORKDIR /app
COPY . .

RUN mkdir -p dict && \
    if [ ! -f dict/words.txt ]; then \
        curl -sSLko dict/words.txt https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt; \
    fi

RUN CGO_ENABLED=0 GOOS=linux go build -o /spell-backend main.go

FROM alpine:latest

WORKDIR /app

COPY --from=builder /spell-backend .
COPY --from=builder /app/dict ./dict
COPY --from=builder /app/web ./web

EXPOSE 8080

CMD ["./spell-backend"]