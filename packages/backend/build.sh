#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rm -rf "${SCRIPT_DIR}/dist/"

echo "Building viewer frontend..."

pushd "${SCRIPT_DIR}/../viewer"
npm run build
popd

echo "Copying viewer assets..."

rm -rf "${SCRIPT_DIR}/embedding_atlas/static"
rm -rf "${SCRIPT_DIR}/embedding_atlas/widget_static"
cp -r "${SCRIPT_DIR}/../viewer/dist" "${SCRIPT_DIR}/embedding_atlas/static"

pushd "${SCRIPT_DIR}"
npm run build
popd

pushd "${SCRIPT_DIR}"
uv build --wheel
popd
