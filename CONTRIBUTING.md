# Contributing to Rich Tutor

## Development

Create a branch from `main`.

Run local validation before pushing.

## Production

Production deployments are automated from `main`.

Do not commit:

- `.env`
- SQLite production data
- private keys
- passwords
- AWS credentials

## Documentation

Architecture changes should update:

- README
- Wiki
- D2 diagrams
- relevant ADR

UI changes should refresh Playwright screenshots when documentation becomes inaccurate.

## Issues

Engineering changes should have an issue describing:

- problem
- desired outcome
- implementation
- validation
