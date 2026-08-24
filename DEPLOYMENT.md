# Rich Tutor Production Deployment

Production target:

- Host directory: `/home/ubuntu/rich-tutor`
- Container/service: `rich-tutor`
- Host backend: `127.0.0.1:5085`
- Public hostname: `tutor.richmackos.com`
- Persistent database: `data/rich_tutor.db`

## First deployment

On the Mac:

```bash
r53sub -s tutor -i 3.129.79.249 -t 300
dig +short tutor.richmackos.com A
```

On the server, verify the port before using it:

```bash
sudo ss -ltnp | grep ':5085' || echo '5085 FREE'
```

Create the production directory and `.env`, keeping secrets off Git:

```bash
mkdir -p /home/ubuntu/rich-tutor/data /home/ubuntu/rich-tutor/backups
cd /home/ubuntu/rich-tutor
cp .env.example .env
chmod 600 .env
```

Edit `.env` and replace the secret/admin password values.

Deploy the container and verify localhost health:

```bash
docker compose up -d --build --remove-orphans
curl -fsS http://127.0.0.1:5085/health
```

Install the Nginx server block from `deploy/tutor.richmackos.com.nginx`, then:

```bash
sudo nginx -t &&
sudo systemctl reload nginx
```

After DNS and HTTP work:

```bash
sudo certbot \
  --nginx \
  --non-interactive \
  --agree-tos \
  --redirect \
  -m admin@richmackos.com \
  -d tutor.richmackos.com
```

Verify:

```bash
curl -I https://tutor.richmackos.com
curl -fsS https://tutor.richmackos.com/health
```

## Normal updates

GitHub Actions validates, rsyncs while preserving `.env` and `data/`,
runs `richdeploy tutor`, and verifies public `/health`.

Required GitHub Actions secrets:

- `RICH_TUTOR_SSH_PRIVATE_KEY`
- `RICH_TUTOR_PROD_HOST`
- `RICH_TUTOR_PROD_USER`

Recommended values for host/user are the production Lightsail host and `ubuntu`.
Do not commit the private key, `.env`, or production SQLite database.
