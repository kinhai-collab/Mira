# 🎯 Quick Start Guide: WebSocket Reconnection & Audio Interruption

## What Was Implemented

### ✅ 1. Automatic WebSocket Reconnection
- Connection drops? Automatically reconnects after 1s, 2s, 4s, 8s, etc.
- Silent failures detected via ping/pong (every 25 seconds)
- Manual reconnect button appears if auto-reconnect fails

### ✅ 2. Audio Interruption
- User speaks while AI is talking? AI stops immediately
- Audio queue cleared, backend notified
- Prevents old audio from playing after interruption

### ✅ 3. Connection Status UI
- Green dot = Connected
- Yellow dot = Connecting
- Orange dot = Reconnecting
- Red dot = Disconnected
- Auto-hides when connected

## How to Use

### Step 1: Add Connection Status to Your Page

```typescript
// src/app/dashboard/page.tsx (or any page with voice)
'use client';

import { useState } from 'react';
import ConnectionStatus from '@/components/ConnectionStatus';
import { ConnectionState } from '@/utils/voice/WebSocketManager';

export default function DashboardPage() {
  const [connectionState, setConnectionState] = useState(ConnectionState.CLOSED);

  // Listen for connection state changes
  useEffect(() => {
    const handleStateChange = (event: CustomEvent) => {
      setConnectionState(event.detail);
    };

    window.addEventListener('wsStateChange', handleStateChange as EventListener);
    return () => window.removeEventListener('wsStateChange', handleStateChange as EventListener);
  }, []);

  const handleManualReconnect = () => {
    // Force reconnect
    if (window.wsController?.forceReconnect) {
      window.wsController.forceReconnect();
    }
  };

  return (
    <div>
      {/* Connection indicator - auto-hides when connected */}
      <ConnectionStatus 
        state={connectionState} 
        onReconnect={handleManualReconnect}
      />
      
      {/* Your existing content */}
      <YourVoiceInterface />
    </div>
  );
}
```

### Step 2: Test Connection Resilience

1. **Start voice conversation**
2. **Disconnect your network** → Should see "Reconnecting..." with orange dot
3. **Reconnect network** → Should auto-reconnect within seconds
4. **If it doesn't reconnect** → "Reconnect" button appears after 5 seconds

### Step 3: Test Audio Interruption

1. **Start voice conversation**
2. **Ask Mira a question** that triggers a long response
3. **Start speaking while Mira is talking**
4. **Mira should stop immediately** ✅
5. **Console should log:** `🎤 User interruption detected`
6. **Console should log:** `📤 Sent stop_audio signal to backend`

## Files Created/Modified

### Created Files ✨
```
src/
├── components/
│   ├── ConnectionStatus.tsx              # Visual connection indicator
│   └── voice/
│       └── VoiceInterfaceExample.tsx     # Integration example
└── utils/
    └── voice/
        └── WebSocketManager.ts            # WebSocket wrapper with reconnection
```

### Modified Files ✏️
```
src/utils/voice/
├── realtimeSttClient.ts     # Now uses WebSocketManager
└── voiceHandler.ts          # Added audio interruption + state events
```

### Documentation 📝
```
IMPLEMENTATION_SUMMARY.md    # Full technical documentation
QUICK_START.md              # This file
```

## Common Issues & Solutions

### Issue: Connection Status Not Updating
**Solution:** Make sure you added the event listener:
```typescript
useEffect(() => {
  const handleStateChange = (event: CustomEvent) => {
    setConnectionState(event.detail);
  };
  window.addEventListener('wsStateChange', handleStateChange as EventListener);
  return () => window.removeEventListener('wsStateChange', handleStateChange as EventListener);
}, []);
```

### Issue: Manual Reconnect Button Doesn't Work
**Solution:** Check that `wsController` is globally accessible:
```typescript
const handleManualReconnect = () => {
  if (window.wsController?.forceReconnect) {
    window.wsController.forceReconnect();
  } else {
    console.error('wsController not available');
  }
};
```

### Issue: Audio Interruption Too Sensitive
**Solution:** Adjust threshold in `voiceHandler.ts`:
```typescript
// Line ~882 in voiceHandler.ts
if (energy > 12) { // Increase this number (e.g., 15 or 20)
  // Interruption logic
}
```

### Issue: Audio Interruption Not Working
**Solution:** Check console for these logs:
1. `🎤 User interruption detected` - Confirms detection
2. `🛑 Stopping audio playback` - Confirms stop function called
3. `📤 Sent stop_audio signal to backend` - Confirms backend notified

## Testing Checklist

### Reconnection ✅
- [ ] Disconnect network → Auto-reconnects
- [ ] Restart backend → Reconnects when back online
- [ ] 10 failed attempts → Shows manual reconnect button
- [ ] Click reconnect button → Immediately retries
- [ ] Ping timeout → Detects dead connection and reconnects

### Audio Interruption ✅
- [ ] Speak during AI response → AI stops immediately
- [ ] Check console for `stop_audio` message sent
- [ ] Pending audio chunks → Ignored after interruption
- [ ] New user question → Audio plays normally again

### UI States ✅
- [ ] Connected → Green dot (or hidden)
- [ ] Connecting → Yellow dot + "Connecting..."
- [ ] Reconnecting → Orange dot + "Reconnecting..."
- [ ] Disconnected → Red dot + "Disconnected"
- [ ] After 5s → Reconnect button appears

## Architecture Overview

```
User Interface (Your Page)
    ↓ (listens to 'wsStateChange' event)
ConnectionStatus Component
    ↓ (displays state)
    
Voice Handler (voiceHandler.ts)
    ↓ (creates)
Realtime STT Client (realtimeSttClient.ts)
    ↓ (uses)
WebSocketManager (WebSocketManager.ts)
    ↓ (manages)
WebSocket Connection
    ↓ (sends/receives)
Backend Server
```

## Event Flow

### Connection State Changes
```
WebSocketManager detects state change
    → Calls onStateChange callback
    → realtimeSttClient receives callback
    → voiceHandler dispatches 'wsStateChange' event
    → Your page's event listener updates state
    → ConnectionStatus component re-renders
```

### Audio Interruption
```
User starts speaking
    → monitorForInterruption() detects high audio energy
    → stopAudioPlayback() called
    → Sets isAudioInterrupted = true
    → Stops all activeAudioSources
    → Sends {message_type: 'stop_audio'} to backend
    → Incoming audio_chunk messages ignored
    → User stops speaking
    → isAudioInterrupted reset to false
    → New response can play
```

## Configuration

### Reconnection Settings
```typescript
// In WebSocketManager constructor
{
  maxReconnectAttempts: 10,          // Max retries before giving up
  initialReconnectDelay: 1000,       // Start with 1 second delay
  pingInterval: 25000,                // Send ping every 25 seconds
  pongTimeout: 10000,                 // Expect pong within 10 seconds
}
```

### Backoff Schedule
- Attempt 1: 1s delay
- Attempt 2: 2s delay
- Attempt 3: 4s delay
- Attempt 4: 8s delay
- Attempt 5: 16s delay
- Attempt 6+: 30s delay (capped)

### Interruption Settings
```typescript
// In voiceHandler.ts
const interruptThreshold = 12;      // Energy level to trigger interrupt
const consecutiveFrames = 2;        // Consecutive frames above threshold
const checkInterval = 100;          // Check every 100ms
```

## Backend Requirements

Your backend should handle:

1. **Ping/Pong** (✅ already implemented)
```json
// Receive
{"message_type": "ping"}

// Respond
{"message_type": "pong"}
```

2. **Stop Audio** (needs implementation)
```json
// Receive
{"message_type": "stop_audio"}

// Action: Cancel TTS generation, stop sending audio_chunk messages
```

## Next Steps

1. ✅ Add `ConnectionStatus` to your main voice interface page
2. ✅ Test reconnection by disconnecting network
3. ✅ Test audio interruption by speaking during AI response
4. ⚠️ Implement `stop_audio` handler in backend (if not already done)
5. ⚠️ Adjust thresholds based on testing feedback

## Support

### Console Debugging

Enable detailed logs by checking for these patterns:
- `[WebSocketManager]` - Connection management
- `[realtimeSttClient]` - STT client operations
- `🔄 WebSocket state changed:` - State transitions
- `🎤 User interruption detected` - Interruption triggers
- `🛑 Stopping audio playback` - Audio stop execution
- `📤 Sent stop_audio signal` - Backend notification

### Troubleshooting Steps

1. **Open browser console** (F12)
2. **Filter logs** by `WebSocket` or `audio`
3. **Look for errors** (red text)
4. **Check Network tab** for WebSocket connection
5. **Verify backend logs** for received messages

## Advanced Usage

### Custom Reconnection Logic
```typescript
import { WebSocketManager, ConnectionState } from '@/utils/voice/WebSocketManager';

const wsManager = new WebSocketManager({
  // ... config
  onStateChange: (state) => {
    if (state === ConnectionState.CLOSED) {
      // Custom handling when connection closes
      showNotification('Connection lost, attempting to reconnect...');
    }
    
    if (state === ConnectionState.OPEN) {
      // Custom handling when connection restored
      showNotification('Connection restored!');
      reloadData();
    }
  },
});
```

### Programmatic Reconnection
```typescript
// Force reconnect from anywhere in your code
if (window.wsController?.forceReconnect) {
  window.wsController.forceReconnect();
}
```

### Monitoring Connection Health
```typescript
// Check current state
const currentState = wsManager.getState();

// Check if ready to send
if (wsManager.isReady()) {
  wsManager.send({ message_type: 'test' });
}
```

## Performance Notes

- **Ping interval:** 25s balances timeout prevention vs bandwidth
- **Pong timeout:** 10s quickly detects dead connections
- **Exponential backoff:** Prevents server overload during outages
- **Message queue:** Prevents data loss during brief disconnections
- **Audio interruption:** 100ms detection interval is responsive but not CPU-intensive

---

**Questions?** Check `IMPLEMENTATION_SUMMARY.md` for full technical details.
