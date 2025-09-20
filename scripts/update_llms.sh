#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT_DIR/docs/llms.txt"
SOURCE_URL="https://open.longbridge.com/llms.txt"

curl -sSL "$SOURCE_URL" -o "$TARGET"
echo "Updated $TARGET from $SOURCE_URL"
