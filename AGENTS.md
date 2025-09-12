# Repository Guidelines

## Project Structure & Module Organization
- `src/auto-post.js`: Main entry. Implements `GitHubTrendingBot` (fetch trending, de-dupe via Issues, generate text, post to X).
- `src/test.js`: Dry‑run entry that subclasses the bot to avoid real posting; used for local testing and CI manual runs.
- `.github/workflows/hoge.yaml`: Schedules runs (cron) and supports `workflow_dispatch` with a `test_mode` input.
- `screenshots/`: Stores captured images for posts.
- `package.json`: ESM (`type: module`), Node `>=18`, scripts.

## Build, Test, and Development Commands
- `npm install` — Install dependencies.
- `npm start` — Run production flow (`node src/auto-post.js`). Requires valid secrets.
- `npm test` — Run dry‑run flow (`node src/test.js`). Skips real X posting/Issue writes.
- Example local run with env vars:
  - `GITHUB_TOKEN=... OPENAI_API_KEY=... node src/test.js`

## Coding Style & Naming Conventions
- Language: JavaScript (ESM). Use `import`/`export` and async/await.
- Indentation: 2 spaces; keep lines concise and readable.
- Naming: descriptive camelCase for functions (`getTrendingRepositories`, `generateTweetText`), PascalCase for classes.
- No linter/formatter configured; match existing style and minimize diff noise.

## Testing Guidelines
- Tests run via the dry‑run entry (`npm test`). Ensure logs demonstrate the full flow without external side effects.
- When adding features, gate external calls behind a test mode flag (e.g., `process.env.TEST_MODE === 'true'`).
- Prefer small, easily verifiable units (helpers in `src/`) that can be exercised from `src/test.js`.

## Commit & Pull Request Guidelines
- Commits: imperative mood and scope prefix when helpful (e.g., `feat:`, `fix:`, `docs:`). Example: `feat: add duplicate check using Issues labels`.
- PRs: include a clear description, linked issues, screenshots/log snippets of dry‑run output, notes on new env vars or workflow changes, and README updates when user‑facing behavior changes.

## Security & Configuration Tips
- Do not hardcode secrets. Use GitHub Actions Secrets: `GITHUB_TOKEN`, `OPENAI_API_KEY`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN`.
- Validate required env vars early; fail fast with helpful messages.
- Be mindful of API rate limits and OpenAI cost; prefer test mode during development.

