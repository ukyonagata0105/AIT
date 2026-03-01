#!/bin/bash

# Playwright ALT Bridge Script
# This script verifies the connection to the IDE's internal browser.

echo "🔍 Checking Internal Browser status..."

# Check if CDP port is open
if lsof -Pi :9223 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Internal Browser CDP detected on port 9223."
    echo "🌐 BROWSER_CDP_URL: $BROWSER_CDP_URL"
    echo ""
    echo "エージェントへの指示:"
    echo "1. 新しいブラウザを launch しないでください。"
    echo "2. playwright.chromium.connectOverCDP('$BROWSER_CDP_URL') を使用してください。"
else
    echo "❌ Internal Browser CDP (port 9223) is NOT responding."
    echo "IDE の右パネルにあるブラウザ（🌐）が開いているか確認してください。"
fi
