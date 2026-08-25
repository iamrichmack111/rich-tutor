# ADR 0002: Persist SQLite Outside the Container

## Status

Accepted

## Decision

Mount the host `data/` directory at `/app/data`.

## Reason

User accounts, grades, invitations, mastery, and time tracking must survive container replacement.

## Consequence

Host filesystem ownership must match the container runtime user.
