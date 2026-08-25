# Security Policy

Do not report credentials, private keys, tokens, personal student information, or security-sensitive production details in a public GitHub issue.

For security findings, contact the repository owner privately.

## Security Design

Rich Tutor uses:

- password hashing
- role-based access
- HTTPS
- loopback-bound Gunicorn
- persistent secrets outside Git
- GitHub Actions secrets
- CI secret scanning
- account disable controls
- temporary-password rotation
