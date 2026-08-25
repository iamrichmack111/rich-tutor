# ADR 0001: Containerize the Flask Application

## Status

Accepted

## Decision

Run Rich Tutor as a Docker container using Gunicorn.

## Context

The application requires repeatable local and production runtime behavior.

## Consequences

Benefits:

- deterministic deployment
- consistent dependency environment
- CI build validation
- simple service replacement

Production state must therefore remain outside the disposable image.
