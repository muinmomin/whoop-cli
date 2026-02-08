# whoop-cli

Bun-first WHOOP CLI with transparent auth and a simple `stats` command.

## Development Setup

```bash
bun install
cp .env.example .env
# edit .env with your WHOOP email + password
```

Required env vars:

```bash
WHOOP_EMAIL=you@example.com
WHOOP_PASSWORD=your-password
```

## Homebrew Install

```bash
brew tap muinmomin/whoop
brew install whoop
```

## Commands

```bash
whoop auth
```

Validates WHOOP auth and prints token expiry.

```bash
whoop stats
```

Fetches daily stats for local today (default output is JSON).

```bash
whoop stats --date 2025-08-24 --json
```

Fetches daily stats for a specific date.

```bash
whoop stats --date 2025-08-24 --text
```

Fetches the same daily data, formatted for humans using your machine timezone.

```bash
whoop stats --startDate 2025-08-01 --endDate 2025-08-24 --json
```

Fetches date-range summary stats.

```bash
whoop stats --help
```

Shows stats command help.

For local development without Homebrew install:

```bash
bun run auth
bun run stats --date 2025-08-24 --text
```

## Daily Output Includes

- `day`: start/end
- `sleep`: score, hours, `hoursVsNeeded`, hours needed, 30d sleep hours avg, efficiency, RHR (value + 30d avg), HRV (value + 30d avg), bed/wake time, REM/deep/light stages
- `steps`: value + 30d avg
- `workouts`: name, start, end, duration
- `healthspan`: whoop age, years difference, pace of aging, next update

## Range Output Includes

- date span + day count
- sleep score stats (avg/min/max)
- RHR stats (avg/min/max)
- steps stats (avg/min/max)
- workouts total + unique types
- healthspan snapshot from end date

## Notes

- Date format is `YYYY-MM-DD`.
- Use either `--date` or `--startDate` + `--endDate`.
- Use either `--text` or `--json` (not both).
- Command exits non-zero on API/auth errors.

## Homebrew Release Flow

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Create and push a matching git tag: `v<version>` (example: `v0.2.0`).
4. GitHub Actions workflow `/Users/muin/Developer/whoop-cli/.github/workflows/release-homebrew.yml` builds release assets:
   - `whoop-darwin-arm64.tar.gz`
   - `whoop-darwin-x86_64.tar.gz`
   - matching `.sha256` files
5. Update your tap formula with the new version and checksums.
   - Template: `/Users/muin/Developer/whoop-cli/packaging/homebrew/whoop.rb.template`
