#!/usr/bin/env bash
# Creates android/, ios/, etc. next to pubspec.yaml if missing (safe to re-run).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter is not on PATH. Install from https://docs.flutter.dev/get-started/install"
  exit 1
fi

if [[ ! -d android/app ]] || [[ ! -f ios/Runner.xcodeproj/project.pbxproj ]]; then
  echo "Running: flutter create . --project-name adakaro_mobile"
  flutter create . --project-name adakaro_mobile
else
  echo "Platform folders already present (android/, ios/). Skipping flutter create."
fi

echo "Running: flutter pub get"
flutter pub get

echo "Running: flutter analyze"
flutter analyze

echo "Done. Run the app with dart-defines from README.md."
