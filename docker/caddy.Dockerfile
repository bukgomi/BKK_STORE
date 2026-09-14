# Caddy + DuckDNS DNS 플러그인 (인증서를 DNS-01 방식으로 발급 → 80/443 이 외부에서 막혀 있어도 발급 가능)
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
