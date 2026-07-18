#!/usr/bin/env bash
# Giám sát Quick Tunnel (forestgump-quicktunnel) cho self-host qua Cloudflare
# Tunnel (docker-compose.selfhost.yml). Quick Tunnel KHÔNG có cam kết uptime
# và URL đổi mỗi lần restart (xem DEPLOY.md mục E.2) — script này:
#
#   1. Mỗi CHECK_INTERVAL giây, gọi THẬT /api/dienbien-forecast qua URL tunnel
#      hiện tại (exercise toàn chuỗi tunnel -> backend -> ai_engine ->
#      Open-Meteo, không chỉ health check rỗng).
#   2. Chỉ reset (docker restart container) khi lần gọi đó THẤT BẠI (hoặc
#      chưa có URL nào) — không reset vô điều kiện, vì restart liên tục sẽ
#      làm tunnel mất ổn định hơn (mỗi lần cần ~5-8s để reconnect).
#   3. Sau reset, tự lấy URL mới từ log container, ghi vào dashboard/.env
#      (Vite tự phát hiện .env đổi và restart dev server — không cần thao
#      tác thủ công).
#
# Chạy nền:
#   nohup ./infra/tunnel-watchdog.sh > /tmp/tunnel-watchdog.log 2>&1 &
# Dừng: kill process đó (hoặc Ctrl+C nếu chạy foreground).

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD_ENV="$REPO_ROOT/dashboard/.env"
CONTAINER="forestgump-quicktunnel"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"

log() {
	printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

current_tunnel_url() {
	grep -oE '^PUBLIC_API_URL=https://[a-zA-Z0-9.-]+' "$DASHBOARD_ENV" 2>/dev/null | cut -d= -f2
}

# Đợi tối đa ~20s để cloudflared in ra URL trycloudflare.com mới sau restart.
wait_for_new_url() {
	local i url
	for i in 1 2 3 4 5 6 7 8 9 10; do
		url=$(docker logs "$CONTAINER" 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
		if [ -n "$url" ]; then
			printf '%s' "$url"
			return 0
		fi
		sleep 2
	done
	return 1
}

reset_tunnel() {
	log "RESET: restart container $CONTAINER"
	docker restart "$CONTAINER" >/dev/null 2>&1
	sleep 5

	local new_url
	new_url=$(wait_for_new_url) || {
		log "RESET FAILED: không lấy được URL mới sau restart"
		return 1
	}
	log "RESET OK: URL mới = $new_url"

	if grep -q '^PUBLIC_API_URL=' "$DASHBOARD_ENV" 2>/dev/null; then
		sed -i "s#^PUBLIC_API_URL=.*#PUBLIC_API_URL=$new_url#" "$DASHBOARD_ENV"
	else
		printf 'PUBLIC_API_URL=%s\n' "$new_url" >>"$DASHBOARD_ENV"
	fi
	log "Đã cập nhật $DASHBOARD_ENV -> PUBLIC_API_URL=$new_url"
}

log "Bắt đầu giám sát tunnel, chu kỳ ${CHECK_INTERVAL}s (Ctrl+C để dừng)..."

while true; do
	url=$(current_tunnel_url)
	if [ -z "$url" ]; then
		log "CHECK: chưa có PUBLIC_API_URL trong dashboard/.env"
		reset_tunnel
	else
		status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url/api/dienbien-forecast" 2>/dev/null)
		if [ "$status" = "200" ]; then
			log "CHECK OK: $url -> 200"
		else
			log "CHECK FAIL: $url -> ${status:-timeout}"
			reset_tunnel
		fi
	fi
	sleep "$CHECK_INTERVAL"
done
