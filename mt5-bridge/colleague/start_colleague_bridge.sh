#!/usr/bin/env bash
# TradeIntel AI — start colleague MT5 bridge
set -e
cd "$(dirname "$0")/.."
python3 colleague/setup_colleague_bridge.py
