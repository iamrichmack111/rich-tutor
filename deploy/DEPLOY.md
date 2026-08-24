# Separate subdomain deployment

Recommended pattern: `math.yourdomain.com`.

1. Create an A record for the subdomain pointing to the server.
2. Copy this app to `/home/ubuntu/math-tutor`.
3. Create the venv and install:
   `pip install flask gunicorn manim`
4. Install `deploy/math-tutor.service` as a systemd service.
5. Replace `math.example.com` in `deploy/nginx-subdomain.conf`.
6. Enable the nginx site and reload nginx.
7. Add TLS with your existing certificate/ACME workflow.

The Flask app itself remains on localhost port 5055 behind nginx.
