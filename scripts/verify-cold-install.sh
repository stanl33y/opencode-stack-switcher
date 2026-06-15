#!/bin/bash

# OpenCode Stack Switcher - Cold Install Verification Script
# This script tests a fresh installation from scratch

set -e

echo "🔍 OpenCode Stack Switcher - Cold Install Verification"
echo "====================================================="

# Create temporary directory for testing
TEMP_DIR=$(mktemp -d)
echo "📁 Testing in temporary directory: $TEMP_DIR"

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

echo "📥 Cloning repository..."
cd "$TEMP_DIR"
git clone https://github.com/stanl33y/opencode-stack-switcher.git
cd opencode-stack-switcher

echo "📦 Installing dependencies..."
bun install

echo "⚙️  Initializing OCS..."
bun run src/cli.ts init

echo "🔍 Testing basic functionality..."
bun run src/cli.ts list

echo "✅ Cold install verification completed successfully!"
echo ""
echo "📋 Verification Results:"
echo "  ✅ Repository cloned successfully"
echo "  ✅ Dependencies installed without errors"
echo "  ✅ 'ocs init' command executed successfully"
echo "  ✅ 'ocs list' command executed successfully"
echo ""
echo "🎉 OCS is ready to use!"