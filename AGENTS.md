# Project Instructions

## Stack
- Frontend: Next.js App Router, React, TypeScript, Ant Design, TailwindCSS
- Backend: Spring Boot WebFlux / Nest.js depending on module
- DB: MariaDB/MySQL, PostgreSQL/TimescaleDB
- Auth: Keycloak, JWT
- Tests: Vitest/Jest for frontend, Gradle/JUnit for Spring Boot

## General Rules
- Do not introduce new libraries without explaining why.
- Prefer minimal diffs.
- Follow existing project patterns before creating new abstractions.
- Do not modify auth, permission, or security-sensitive logic without explaining risk.
- Do not edit .env, secrets, credentials, or production config files.

## Frontend Rules
- Use existing component patterns before creating new components.
- Keep client components minimal.
- Prefer typed props and avoid `any`.
- For forms, follow existing React Hook Form / Zod / Yup pattern.
- Run typecheck and relevant tests after changes.

## Backend Rules
- Follow existing controller/service/repository boundaries.
- Do not change DB schema without a migration plan.
- For MyBatis changes, verify mapper XML and DTO mapping together.
- For WebFlux, avoid blocking calls unless existing pattern explicitly allows it.

## Verification
- Frontend: yarn typecheck, yarn lint, yarn test
- Spring Boot: ./gradlew test
- Nest.js: yarn test, yarn lint
- After changes, summarize:
  1. files changed
  2. reason for each change
  3. tests run
  4. remaining risks

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
