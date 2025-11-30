# WebSocket Reconnection & Audio Interruption Implementation

## ✅ Implemented Features

### 1. WebSocket Manager with Auto-Reconnection
**File:** `src/utils/voice/WebSocketManager.ts`

Features implemented:
- ✅ Automatic reconnection with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s max)
- ✅ Maximum 10 reconnection attempts (configurable)
- ✅ Keepalive ping/pong mechanism (25s interval, 10s timeout)
- ✅ Connection state management (CONNECTING, OPEN, CLOSED, RECONNECTING)
- ✅ Message queuing during disconnection
- ✅ Manual reconnection support (forceReconnect())
- ✅ Automatic pong detection (handled internally)

#### Usage Example:
```typescript
import { WebSocketManager, ConnectionState } from '@/utils/voice/WebSocketManager';

const wsManager = new WebSocketManager({
  wsUrl: 'ws://127.0.0.1:8000/api/ws/voice-stt',
  token: 'your-auth-token',
  onMessage: (data) => {
    console.log('Received:', data);
  },
  onStateChange: (state) => {
    console.log('Connection state:', state);
    // Update UI based on state
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  },
  maxReconnectAttempts: 10,
  initialReconnectDelay: 1000,
  pingInterval: 25000,
  pongTimeout: 10000,
});

// Connect
await wsManager.connect();

// Send message
wsManager.send({ message_type: 'test', data: 'hello' });

// Force reconnection (e.g., manual reconnect button)
wsManager.forceReconnect();

// Close connection
wsManager.close(true); // true = permanent close, false = allow reconnection
```

### 2. Connection Status UI Component
**File:** `src/components/ConnectionStatus.tsx`

Features:
- ✅ Visual indicator (green/yellow/orange/red)
- ✅ Auto-hides when connected
- ✅ Shows "Reconnecting..." during reconnection
- ✅ Manual reconnect button after 5 seconds
- ✅ Animated pulse during connection attempts

#### Integration Example:
```typescript
'use client';

import ConnectionStatus from '@/components/ConnectionStatus';
import { ConnectionState } from '@/utils/voice/WebSocketManager';
import { useState } from 'react';

export default function YourPage() {
  const [connectionState, setConnectionState] = useState(ConnectionState.CLOSED);

  const handleReconnect = () => {
    // Call your WebSocket manager's forceReconnect
    wsManager?.forceReconnect();
  };

  return (
    <>
      <ConnectionStatus 
        state={connectionState} 
        onReconnect={handleReconnect}
      />
      {/* Your page content */}
    </>
  );
}
```

### 3. Realtime STT Client Integration
**File:** `src/utils/voice/realtimeSttClient.ts`

Changes made:
- ✅ Replaced raw WebSocket with WebSocketManager
- ✅ Added connection state management
- ✅ Integrated ping/pong keepalive
- ✅ Added forceReconnect() method
- ✅ Message queuing during reconnection
- ✅ onStateChange callback for UI updates

Updated API:
```typescript
const sttClient = createRealtimeSttClient({
  wsUrl: 'ws://127.0.0.1:8000/api/ws/voice-stt',
  token: authToken,
  onMessage: handleMessage,
  onStateChange: (state) => {
    // Update UI with connection state
    setConnectionState(state);
  },
  // ... other callbacks
});

// New methods available:
sttClient.send({ message_type: 'custom' }); // Send custom messages
sttClient.forceReconnect(); // Force immediate reconnection
```

### 4. Audio Interruption Handling
**File:** `src/utils/voice/voiceHandler.ts`

Features implemented:
- ✅ Stop audio playback when user speaks
- ✅ Clear audio queue on interruption
- ✅ Send `stop_audio` message to backend
- ✅ Ignore incoming audio chunks during interruption
- ✅ Reset interruption flag when user stops speaking
- ✅ Track all active audio sources for cleanup

Key Functions:
```typescript
// Stop all audio playback (called on user interruption)
stopAudioPlayback();

// Reset audio state (called when starting new conversation)
resetAudioState();
```

Variables added:
```typescript
let isAudioInterrupted = false;         // Flag to ignore incoming chunks
let activeAudioSources = [];            // Track all Web Audio API sources
```

Flow:
1. User starts speaking → `monitorForInterruption()` detects audio energy
2. High energy detected (2 consecutive frames > threshold)
3. `stopAudioPlayback()` called:
   - Sets `isAudioInterrupted = true`
   - Stops all `activeAudioSources` (Web Audio API)
   - Stops `currentAudio` (HTML5 Audio)
   - Sends `{message_type: 'stop_audio'}` to backend
4. Incoming `audio_chunk` messages ignored while interrupted
5. User stops speaking → `activeRecorder.onstop` resets `isAudioInterrupted = false`
6. New AI response can play normally

## 📋 Configuration Summary

### WebSocketManager Configuration
```typescript
{
  maxReconnectAttempts: 10,          // Stop after 10 failed attempts
  initialReconnectDelay: 1000,       // First retry after 1 second
  pingInterval: 25000,                // Send ping every 25 seconds
  pongTimeout: 10000,                 // Expect pong within 10 seconds
}
```

### Reconnection Backoff Schedule
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds
- Attempt 6+: 30 seconds (capped)

### Audio Interruption Settings
```typescript
const silenceThreshold = 0.01;     // RMS threshold for VAD
const interruptThreshold = 12;      // Energy level to trigger interrupt
const consecutiveFrames = 2;        // Require 2 frames to confirm
```

## 🔧 Backend Requirements

### Stop Audio Message
Backend should handle:
```json
{
  "message_type": "stop_audio"
}
```

Action: Cancel current TTS generation and stop sending `audio_chunk` messages.

### Ping/Pong Messages
Backend already implements (✅ confirmed):
- Receives: `{"message_type": "ping"}`
- Responds: `{"message_type": "pong"}`

## 🎯 Testing Checklist

### Connection Resilience
- [ ] Disconnect network → Should auto-reconnect with backoff
- [ ] Restart backend → Should reconnect when backend comes back
- [ ] Force close connection → Should attempt reconnection
- [ ] 10+ failed attempts → Should stop and show manual reconnect button
- [ ] Ping timeout → Should detect and reconnect
- [ ] Manual reconnect button → Should reset counter and retry immediately

### Audio Interruption
- [ ] Start speaking while AI is talking → AI should stop immediately
- [ ] Audio chunks still arriving → Should be ignored
- [ ] Backend should receive `stop_audio` message
- [ ] After interruption → New AI response should play normally
- [ ] Web Audio API sources → Should all be stopped and cleaned up
- [ ] HTML5 audio → Should be paused and reset

### UI Updates
- [ ] Connection state changes → Status indicator updates correctly
- [ ] Green indicator when connected
- [ ] Yellow during initial connection
- [ ] Orange during reconnection
- [ ] Red when disconnected
- [ ] Reconnect button appears after 5 seconds
- [ ] Status hides when connection restored

## 📁 File Structure
```
frontend/
├── src/
│   ├── components/
│   │   └── ConnectionStatus.tsx          ✨ NEW - Connection status UI
│   ├── utils/
│   │   └── voice/
│   │       ├── WebSocketManager.ts       ✨ NEW - WebSocket wrapper
│   │       ├── realtimeSttClient.ts      ✏️  MODIFIED - Uses WebSocketManager
│   │       └── voiceHandler.ts           ✏️  MODIFIED - Audio interruption
│   └── app/
│       └── [your-pages]/
│           └── page.tsx                  ✏️  INTEGRATE - Add ConnectionStatus
└── IMPLEMENTATION_SUMMARY.md             ✨ NEW - This file
```

## 🚀 Next Steps

1. **Integrate ConnectionStatus component** in your main voice interface page
2. **Test reconnection** by disconnecting network/restarting backend
3. **Test audio interruption** by speaking while AI is talking
4. **Monitor console logs** for connection state changes and audio interruptions
5. **Adjust thresholds** if interruption is too sensitive/insensitive

## 🐛 Troubleshooting

### Reconnection Issues
- Check browser console for `[WebSocketManager]` logs
- Verify backend is sending `pong` responses to `ping` messages
- Ensure token is valid and not expired during reconnection
- Check network tab for WebSocket connection attempts

### Audio Interruption Issues
- Check console for `🎤 User interruption detected` messages
- Verify `stop_audio` message is sent to backend
- Adjust `interruptThreshold` (currently 12) if too sensitive/insensitive
- Check that `isAudioInterrupted` flag is properly reset

### State Sync Issues
- Ensure `onStateChange` callback is connected to UI state
- Verify ConnectionStatus component receives updated state
- Check that all WebSocket events properly update state

## 📝 Notes

- WebSocketManager handles ping/pong automatically - no manual intervention needed
- Message queue prevents data loss during brief disconnections
- Exponential backoff prevents server overload during outages
- Audio interruption is immediate - no delay or buffering
- All active audio sources are tracked and cleaned up properly

## ⚡ Performance

- Ping interval: 25s (prevents timeout, minimal bandwidth)
- Pong timeout: 10s (quick dead connection detection)
- Audio interruption detection: 100ms intervals
- Reconnection: Exponential backoff reduces server load
- Message queue: Prevents data loss during reconnection

## 🔐 Security

- Auth token sent during initial connection and after reconnection
- Token masked in console logs (shows only first 20 chars + `...`)
- WebSocket connections use same authentication as HTTP
- No credentials stored in component state
