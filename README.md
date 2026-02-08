# whoop-cli

Simple Bun-based WHOOP CLI with transparent auth and one core command: `stats`.

## Setup

```bash
bun install
cp .env.example .env
```

Set your WHOOP credentials in `.env`:

```bash
WHOOP_EMAIL=you@example.com
WHOOP_PASSWORD=your-password
```

## Install (Homebrew)

This repo is its own tap.

```bash
brew tap muinmomin/whoop-cli https://github.com/muinmomin/whoop-cli
brew install muinmomin/whoop-cli/whoop
```

Current binary target: macOS arm64 (Apple Silicon).

## Commands

```bash
whoop auth
whoop stats
whoop stats --date 2026-02-07 --json
whoop stats --date 2026-02-07 --text
whoop stats --help
```

Notes:

- `whoop stats` defaults to local today when `--date` is omitted.
- Use `--json` or `--text` (not both).

For local dev (without Homebrew install):

```bash
bun run auth
bun run stats --text
```

## What `stats` Returns

- `day`: start/end
- `sleep`: score, hours, hours vs needed, hours needed, 30d hours avg, efficiency, RHR (value + 30d avg), HRV (value + 30d avg), bed/wake time, REM/deep/light
- `steps`: value + 30d avg
- `workouts`: name, start, end, duration
- `healthspan`: whoop age, years difference, pace of aging, next update

## Release Flow

1. Bump `version` in `package.json`.
2. Commit and push `main`.
3. Create and push a matching tag, for example:

```bash
git tag v0.1.1
git push origin v0.1.1
```

What happens automatically:

- GitHub Actions builds `whoop-darwin-arm64.tar.gz`.
- GitHub Release is created/updated for that tag.
- `Formula/whoop.rb` is updated with the exact version + SHA256 and pushed to `main`.
