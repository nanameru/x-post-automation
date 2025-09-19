#!/usr/bin/env bash

# Enforce PKCE-only flow for token exchange
set -euo pipefail

if [[ -z "${X_CLIENT_ID:-}" || -z "${X_REDIRECT_URI:-}" ]]; then
  echo "X_CLIENT_ID and X_REDIRECT_URI are required" >&2
  exit 1
fi

if [[ -z "${X_CODE_VERIFIER:-}" ]]; then
  echo "X_CODE_VERIFIER is required (generate via: node pkce-helper.js)" >&2
  exit 1
fi

unset X_CLIENT_SECRET
export X_FLOW=pkce

if [[ $# -lt 1 ]]; then
  echo "Usage: ./pkce-only.sh <AUTHORIZATION_CODE>" >&2
  exit 1
fi

node get-token.js "$1"


