# whoop-cli

A simple Bun-based CLI for WHOOP ready to use with your favorite agent: transparent auth and clean daily stats output in JSON or human/agent-readable text.

## Install (Homebrew)

This repo is its own tap.

```bash
brew tap muinmomin/whoop-cli https://github.com/muinmomin/whoop-cli
brew install muinmomin/whoop-cli/whoop
```

Current binary target: macOS arm64 (Apple Silicon).

## Updating

To update to the latest released version:

```bash
brew update
brew upgrade muinmomin/whoop-cli/whoop
```

## Usage

Required environment variables:

```bash
WHOOP_EMAIL=you@example.com
WHOOP_PASSWORD=your-password
```

Set them in your shell:

```bash
export WHOOP_EMAIL=you@example.com
export WHOOP_PASSWORD=your-password
```

Commands:

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

## What `stats` Returns

- `day`: start/end
- `sleep`: score, hours, hours vs needed, hours needed, 30d hours avg, efficiency, RHR (value + 30d avg), HRV (value + 30d avg), bed/wake time, REM/deep/light
- `steps`: value + 30d avg
- `weight`: value + 30d avg
- `workouts`: name, start, end, duration
- `healthspan`: whoop age, years difference, pace of aging, next update

## Release Flow

```bash
bun run release:patch
```

Other options:

```bash
bun run release:minor
bun run release:major
bun run release -- 0.1.1
```

What happens automatically:

- Script runs typecheck.
- Script bumps `package.json` version, creates a release commit, and creates a matching git tag.
- Script pushes `main` with tags.
- GitHub Actions builds `whoop-darwin-arm64.tar.gz`.
- GitHub Release is created/updated for that tag.
- `Formula/whoop.rb` is updated with the exact version + SHA256 and pushed to `main`.

## Development

```bash
bun install
export WHOOP_EMAIL=you@example.com
export WHOOP_PASSWORD=your-password
bun run auth
bun run stats --text
```
