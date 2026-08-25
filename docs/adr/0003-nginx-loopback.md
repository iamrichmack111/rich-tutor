# ADR 0003: Keep Gunicorn on Loopback

## Status

Accepted

## Decision

Expose Rich Tutor on `127.0.0.1:5085` only.

Nginx provides the public HTTPS interface.

## Benefit

Gunicorn is not directly Internet-facing.
