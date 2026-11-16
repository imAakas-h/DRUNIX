#!/usr/bin/env bash
set -euo pipefail

GO_VERSION="1.26.1"
NODE_VERSION="v24.14.0"
ARCH="$(dpkg --print-architecture)"
case "$ARCH" in
  amd64) GO_ARCH="amd64"; NODE_ARCH="x64" ;;
  arm64) GO_ARCH="arm64"; NODE_ARCH="arm64" ;;
  *) echo "Unsupported Ubuntu architecture: $ARCH" >&2; exit 1 ;;
esac

sudo apt-get update
sudo apt-get install -y ca-certificates curl git jq build-essential tar xz-utils

mkdir -p "$HOME/.local/opt" "$HOME/.cache/rasid-downloads"

GO_ARCHIVE="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
GO_HOME="$HOME/.local/opt/go-${GO_VERSION}"
if [[ ! -x "$GO_HOME/bin/go" ]]; then
  GO_SHA="$(curl -fsSL 'https://go.dev/dl/?mode=json&include=all' | jq -r --arg version "go${GO_VERSION}" --arg file "$GO_ARCHIVE" '.[] | select(.version == $version) | .files[] | select(.filename == $file) | .sha256' | head -n 1)"
  [[ -n "$GO_SHA" && "$GO_SHA" != "null" ]] || { echo "Official Go checksum not found for $GO_ARCHIVE" >&2; exit 1; }
  curl -fsSL "https://go.dev/dl/${GO_ARCHIVE}" -o "$HOME/.cache/rasid-downloads/${GO_ARCHIVE}"
  echo "${GO_SHA}  $HOME/.cache/rasid-downloads/${GO_ARCHIVE}" | sha256sum --check
  mkdir -p "$GO_HOME"
  tar -xzf "$HOME/.cache/rasid-downloads/${GO_ARCHIVE}" -C "$GO_HOME" --strip-components=1
fi

NODE_ARCHIVE="node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_HOME="$HOME/.local/opt/node-${NODE_VERSION}-linux-${NODE_ARCH}"
if [[ ! -x "$NODE_HOME/bin/node" ]]; then
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" -o "$HOME/.cache/rasid-downloads/${NODE_VERSION}-SHASUMS256.txt"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/${NODE_ARCHIVE}" -o "$HOME/.cache/rasid-downloads/${NODE_ARCHIVE}"
  (cd "$HOME/.cache/rasid-downloads" && grep "  ${NODE_ARCHIVE}$" "${NODE_VERSION}-SHASUMS256.txt" | sha256sum --check)
  mkdir -p "$NODE_HOME"
  tar -xJf "$HOME/.cache/rasid-downloads/${NODE_ARCHIVE}" -C "$NODE_HOME" --strip-components=1
fi

PROFILE_LINE='export PATH="$HOME/.local/opt/go-1.26.1/bin:$HOME/.local/opt/node-v24.14.0-linux-'${NODE_ARCH}'/bin:$PATH"'
if ! grep -Fq "$PROFILE_LINE" "$HOME/.bashrc"; then
  printf '\n%s\n' "$PROFILE_LINE" >> "$HOME/.bashrc"
fi
export PATH="$HOME/.local/opt/go-${GO_VERSION}/bin:$NODE_HOME/bin:$PATH"

go version
node --version
npm --version
git --version
jq --version
