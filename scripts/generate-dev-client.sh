#!/usr/bin/env bash
set -euo pipefail

# Simple helper to build and install an Expo development client locally.
# Usage: scripts/generate-dev-client.sh [ios|android]

PLATFORM="${1:-}"

if [[ -z "$PLATFORM" ]]; then
  echo "Usage: $0 [ios|android]" >&2
  exit 1
fi

echo "==> Ensuring dependencies are installed"
npm install

echo "==> Prebuilding native projects (only needed first time or after native changes)"
npx expo prebuild --clean --no-install || true

case "$PLATFORM" in
  ios)
    echo "==> Building and launching iOS dev client"
    npx expo run:ios
    ;;
  android)
    echo "==> Building and launching Android dev client"
    npx expo run:android
    ;;
  *)
    echo "Unknown platform: $PLATFORM (expected ios or android)" >&2
    exit 1
    ;;
esac

echo "==> Done. Open the app and test push notifications and WebCrypto paths."

