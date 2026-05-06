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
- `sleep`: score, hours, hours vs needed, hours needed, 30d hours avg, efficiency (value + 30d avg), consistency (value + 30d avg), RHR (value + 30d avg), HRV (value + 30d avg), bed/wake time, REM/deep/light
- `steps`: value + 30d avg
- `weight`: value + 30d avg
- `vo2Max`: value + 30d avg (when available in Whoop home key stats)
- `workouts`: name, start, end, duration
- `healthspan`: date range, whoop age, previous whoop age, years difference, pace of aging, previous pace of aging, next update

## Example Output (Anonymized)

Sample values below are redacted and representative only.

### JSON (`whoop stats --json`)

```json
{
  "date": "2026-01-15",
  "day": {
    "start": "2026-01-15T06:42:10-05:00",
    "end": null
  },
  "sleep": {
    "score": 82,
    "hours": "7h 18m",
    "hoursVsNeeded": 88,
    "hoursNeeded": "8h 17m",
    "hours30dAvg": "7h 05m",
    "efficiency": 92,
    "efficiency30dAvg": 90,
    "consistency": 86,
    "consistency30dAvg": 81,
    "rhr": {
      "value": 56,
      "avg30d": 58
    },
    "hrv": {
      "value": 98,
      "avg30d": 91
    },
    "bedTime": "2026-01-14T23:17:01-05:00",
    "wakeTime": "2026-01-15T06:42:10-05:00",
    "stages": {
      "rem": "1h 40m",
      "deep": "1h 19m",
      "light": "4h 19m"
    }
  },
  "steps": {
    "value": 8421,
    "avg30d": 7610
  },
  "weight": {
    "value": 172.4,
    "avg30d": 173.1
  },
  "vo2Max": {
    "value": 47,
    "avg30d": 46
  },
  "workouts": [
    {
      "name": "Strength Training",
      "start": "2026-01-15T17:45:00.000Z",
      "end": "2026-01-15T18:32:00.000Z",
      "duration": "47m"
    }
  ],
  "healthspan": {
    "whoopAge": 31.2,
    "yearsDifference": -1.1,
    "paceOfAging": 0.8,
    "dateRange": "Jan 12 - Jan 18",
    "previous": {
      "whoopAge": 31.5,
      "paceOfAging": 0.9
    },
    "nextUpdateIn": "3 days"
  }
}
```

### Text (`whoop stats --text`)

```text
WHOOP Stats (Jan 15, 2026)
Timezone: America/New_York

Day
  Start: Jan 15, 2026 at 6:42 AM
  End: n/a

Sleep
  Score: 82%
  Hours: 7h 18m
  Hours vs Needed: 88%
  Hours Needed: 8h 17m
  Hours 30d Avg: 7h 5m
  Efficiency: 92% (30d avg: 90%)
  Consistency: 86% (30d avg: 81%)
  RHR: 56 (30d avg: 58)
  HRV: 98 (30d avg: 91)
  Bed Time: Jan 14, 2026 at 11:17 PM
  Wake Time: Jan 15, 2026 at 6:42 AM
  Stage REM: 1h 40m
  Stage Deep: 1h 19m
  Stage Light: 4h 19m

Steps
  Value: 8421
  Avg 30d: 7610

Weight
  Value: 172.4
  Avg 30d: 173.1

VO2 Max
  Value: 47.0
  Avg 30d: 46.0

Workouts
  - Strength Training
    Start: Jan 15, 2026 at 5:45 PM
    End: Jan 15, 2026 at 6:32 PM
    Duration: 47m

Healthspan
  Date Range: Jan 12 - Jan 18
  WHOOP Age: 31.2
  Previous WHOOP Age: 31.5
  Years Difference: -1.1
  Pace of Aging: 0.8x
  Previous Pace of Aging: 0.9x
  Next Update In: 3 days
```

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
