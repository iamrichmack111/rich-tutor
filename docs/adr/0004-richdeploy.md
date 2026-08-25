# ADR 0004: Server-Side richdeploy Contract

## Status

Accepted

## Decision

GitHub Actions remains a thin deployment orchestrator.

Server-specific deployment behavior lives in:

`richdeploy tutor`

## Responsibilities

- backup database
- repair persistence permissions
- validate application
- rebuild container
- recreate service
- poll health
- display failure logs
