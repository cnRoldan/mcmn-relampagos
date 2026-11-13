#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node -e 'const major=Number(process.versions.node.split(".")[0]);if(major<24){console.error("MCMN requiere Node.js 24 o posterior en el entorno de Codex.");process.exit(1);}'
npm ci --no-audit --no-fund
