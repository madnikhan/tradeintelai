# MT5 Webhook & WebSocket Connectivity Guide

This guide explains how to set up real-time webhook/WebSocket connectivity between your web application and MetaTrader 5 for live trading.

## Current Architecture

Your system currently uses:
1. **File-based communication**: MT5 EA writes commands/responses to files
2. **HTTP Bridge**: Python server reads files and exposes HTTP REST API
3. **Polling**: Web app polls HTTP endpoints every few seconds

## Webhook/WebSocket Architecture

For real-time connectivity, we'll implement:

```
Web App (Next.js) ←→ WebSocket Server ←→ MT5 Bridge ←→ MT5 Terminal
```

## Implementation Options

### Option 1: WebSocket Server (Recommended)

**Pros:**
- Real-time bidirectional communication
- Low latency (< 100ms)
- Push notifications from MT5
- Supports multiple clients

**Cons:**
- Requires WebSocket server
- More complex setup

### Option 2: Server-Sent Events (SSE)

**Pros:**
- Simpler than WebSockets
- One-way push from server to client
- Built into Next.js

**Cons:**
- One-way only (server → client)
- Still need HTTP for client → server

### Option 3: HTTP Webhooks

**Pros:**
- Simple HTTP POST requests
- Works with any HTTP client
- Easy to debug

**Cons:**
- Not truly real-time (requires polling)
- Higher latency

## Recommended: WebSocket Implementation

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Next.js    │◄──WS───►│  WebSocket   │◄──HTTP──►│  MT5 Bridge │
│  Web App    │         │    Server    │         │   (Python)  │
└─────────────┘         └──────────────┘         └─────────────┘
                                                         │
                                                         ▼
                                                   ┌─────────────┐
                                                   │  MT5 EA     │
                                                   │  (MQL5)     │
                                                   └─────────────┘
```

### Components Needed

1. **WebSocket Server** (Node.js/Python)
2. **MT5 Bridge Enhancement** (add WebSocket support)
3. **Next.js WebSocket Client** (connect from frontend)
4. **MT5 EA Updates** (push events to bridge)

## Implementation Steps

### Step 1: Install WebSocket Dependencies

```bash
# For Node.js WebSocket server
npm install ws @types/ws

# For Python WebSocket server (alternative)
pip install websockets asyncio
```

### Step 2: Create WebSocket Server

See `mt5-bridge/websocket-server.ts` (will be created)

### Step 3: Update MT5 Bridge

Add WebSocket push notifications when:
- New position opened
- Position closed
- Price updates
- Account balance changes

### Step 4: Connect from Next.js

Use WebSocket client in React components to receive real-time updates.

## Events to Push

1. **Position Events**
   - `position.opened` - New position opened
   - `position.closed` - Position closed
   - `position.modified` - Position modified

2. **Price Events**
   - `price.update` - Real-time price updates
   - `tick.update` - Tick data updates

3. **Account Events**
   - `account.balance` - Balance changed
   - `account.equity` - Equity changed
   - `account.margin` - Margin changed

4. **Trade Events**
   - `trade.executed` - Trade executed
   - `trade.failed` - Trade failed
   - `trade.pending` - Pending order placed

## Security Considerations

1. **Authentication**: Use JWT tokens for WebSocket connections
2. **Rate Limiting**: Limit message frequency
3. **Encryption**: Use WSS (WebSocket Secure) in production
4. **Validation**: Validate all incoming messages

## Performance

- **Latency**: < 100ms for WebSocket
- **Throughput**: 1000+ messages/second
- **Connections**: Support 100+ concurrent clients

## Quick Start

### 1. Install Dependencies

```bash
npm install ws @types/ws
```

### 2. Start WebSocket Server

```bash
./mt5-bridge/start-websocket-server.sh
```

Or manually:
```bash
npx tsx mt5-bridge/websocket-server.ts
```

### 3. Use in React Components

```tsx
import { useMT5WebSocket } from '@/hooks/useMT5WebSocket';

function MyComponent() {
  const { isConnected, subscribe, client } = useMT5WebSocket();
  
  useEffect(() => {
    if (client) {
      client.on('position.opened', (data) => {
        console.log('New position:', data);
      });
      
      subscribe('position.opened');
      subscribe('price.update');
    }
  }, [client, subscribe]);
  
  return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
}
```

### 4. Integration with MT5 Bridge

The WebSocket server needs to be integrated with your Python MT5 bridge to push events. Update `wine-mt5-connector.py` to send events to the WebSocket server when:
- Positions are opened/closed
- Prices update
- Account balance changes

## Next Steps

1. ✅ Review the WebSocket server implementation
2. ✅ Test with a single account
3. ⏳ Integrate with Python MT5 bridge
4. ⏳ Add authentication and security
5. ⏳ Scale to multiple accounts
6. ⏳ Deploy to production
