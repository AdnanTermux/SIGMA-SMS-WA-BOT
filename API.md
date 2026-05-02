# Public API Documentation

Personal OTP Manager exposes a single read-only public endpoint that returns
**aggregated, anonymised statistics only**. No phone numbers, OTP codes, or
message text are ever returned.

---

## Base URL

```
http://<your-server>:<port>
```

The port is configured in `config.json` under `api.port` (default: `3000`).

---

## Endpoints

### `GET /api/public/stats`

Returns aggregated OTP statistics derived from your local database.

#### Rate Limit

10 requests per minute per IP address (configurable via `api.rate_limit` in
`config.json`).

#### Response — 200 OK

```json
{
  "status": "success",
  "total_otps": 1420,
  "otps_today": 84,
  "last_hour_otps": 11,
  "generated_at": "2026-05-02 18:42:10",
  "by_service": {
    "WhatsApp": 44,
    "Telegram": 21,
    "Instagram": 8
  },
  "hourly_last_24h": {
    "2026-05-02 17:00": 9,
    "2026-05-02 18:00": 11
  }
}
```

| Field              | Type   | Description                                      |
|--------------------|--------|--------------------------------------------------|
| `status`           | string | Always `"success"` on 200                        |
| `total_otps`       | number | Total OTPs received since installation           |
| `otps_today`       | number | OTPs received today (UTC)                        |
| `last_hour_otps`   | number | OTPs received in the last 60 minutes             |
| `generated_at`     | string | Timestamp when this response was generated       |
| `by_service`       | object | Count per detected service name                  |
| `hourly_last_24h`  | object | Per-hour counts for the last 24 hours (UTC keys) |

#### Response — 429 Too Many Requests

```json
{
  "status": "error",
  "message": "Too many requests, please try again later."
}
```

#### Response — 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Internal server error."
}
```

---

### `GET /health`

Liveness check. Not rate-limited.

#### Response — 200 OK

```json
{
  "status": "ok",
  "uptime": 3600.42
}
```

---

## Example

```bash
curl http://localhost:3000/api/public/stats
```

```bash
# With jq for pretty output
curl -s http://localhost:3000/api/public/stats | jq .
```

---

## Privacy & Security

- **No PII is ever returned.** Phone numbers, OTP codes, and raw message text
  are never included in any API response.
- The endpoint returns only numeric aggregates computed from your local
  `database.json`.
- All data stays on your own server; nothing is transmitted externally.
- Rate limiting prevents abuse of the endpoint.

---

## Disabling the API

If you do not want the public API running, set `api.port` to `0` in
`config.json` and restart. The Express server will not bind to any port.
(Alternatively, use a firewall rule to block external access to the port.)
