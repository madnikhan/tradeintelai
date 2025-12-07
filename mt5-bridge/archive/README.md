# Archived Bridge Implementations

This folder contains old/unused bridge implementations that have been replaced.

## Archived Files

- `MT5BridgeEA.mq5` - Old ZeroMQ-based EA (replaced by `MT5FileBridgeEA.mq5`)
- `zmq_server.py` - ZeroMQ bridge server (not used)
- `file-bridge.py` - File bridge implementation (not used)
- `http-bridge.py` - HTTP bridge implementation (replaced by `wine-mt5-connector.py`)
- `start_bridge.sh` - ZeroMQ bridge startup script (not used)
- `start-file-bridge.sh` - File bridge startup script (not used)

## Current Active Implementation

- **EA**: `MT5FileBridgeEA.mq5` - File-based EA (active)
- **Bridge**: `wine-mt5-connector.py` - Wine-compatible HTTP bridge (active)
- **Script**: `start-wine-bridge.sh` - Active bridge startup script

## Why Archived?

These implementations were replaced because:
1. ZeroMQ requires additional dependencies and setup complexity
2. File bridge was replaced by wine-compatible bridge for better Mac/Linux support
3. Multiple implementations caused confusion about which one to use

## If You Need These

If you need to use any of these archived implementations:
1. Move the file back to `mt5-bridge/` directory
2. Update documentation
3. Ensure all dependencies are installed
4. Test thoroughly before using

