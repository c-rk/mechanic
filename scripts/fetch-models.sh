#!/usr/bin/env bash
# Puts the on-device segmentation runtime and model under public/ (served with the web app).
# The files are large, so they are not committed; run after `npm install`.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models public/mediapipe/wasm
cp node_modules/@mediapipe/tasks-vision/vision_bundle.mjs public/mediapipe/
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm public/mediapipe/wasm/
MODEL=public/models/interactive_segmentation.task
if [ ! -s "$MODEL" ]; then
  curl -fsSL --retry 3 -o "$MODEL" \
    https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task
fi
ls -la public/models public/mediapipe
