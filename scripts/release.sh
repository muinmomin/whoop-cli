#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bun run release:patch
  bun run release:minor
  bun run release:major
  bun run release -- <version>

Examples:
  bun run release:patch
  bun run release -- 0.1.1
EOF
}

bump="${1:-}"

if [[ -z "${bump}" || "${bump}" == "--help" || "${bump}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  echo "Error: expected a single bump argument." >&2
  usage
  exit 1
fi

if [[ ! "${bump}" =~ ^(patch|minor|major|[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Error: invalid bump argument '${bump}'. Use patch|minor|major|x.y.z." >&2
  exit 1
fi

echo "Running typecheck..."
bun run typecheck

echo "Bumping version and creating git tag..."
tag="$(bun pm version "${bump}" | tail -n 1 | tr -d '[:space:]')"

if [[ ! "${tag}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: expected bun pm version to return a vX.Y.Z tag, got '${tag}'." >&2
  exit 1
fi

echo "Pushing main and tags..."
git push origin main --follow-tags

echo "Release started for ${tag}"
echo "GitHub Actions will build assets, publish release files, and update Formula/whoop.rb."
