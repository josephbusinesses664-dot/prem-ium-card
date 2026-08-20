# Deploying tap.prem-ium.online

Self-hosted on the fleet box (`josephopenclawbot@100.99.209.83`, Tailscale),
fronted by the existing `prem-ium-laptop` Cloudflare tunnel. There is no
Render involvement.

## Push an update

```sh
npm run build
rsync -az --delete dist/ josephopenclawbot@100.99.209.83:~/premium-tap/dist/
```

Caddy serves `~/premium-tap/dist` on `:8091` under the systemd **user** unit
`premium-tap.service` (`systemctl --user status premium-tap`). No restart is
needed for content changes — only for `~/premium-tap/Caddyfile` edits.

## How the pieces connect

- `~/premium-tap/Caddyfile` sets `Content-Type: text/vcard` on the vCard.
  Without it iOS files the download away instead of offering Contacts.
- The tunnel's ingress rule lives in the box's `~/.cloudflared/config.yml`,
  inserted *before* the `http_status:404` catch-all.
- The DNS CNAME was created from the Mac with
  `cloudflared tunnel route dns de147e36-d1b8-4328-b87d-f49f37907fb1 tap.prem-ium.online`,
  which is authorised by `~/.cloudflared/cert.pem` — no dashboard visit needed.
