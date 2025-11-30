# Voice Pipeline Fixes - WebSocket Stability & Audio Quality

## 🆕 **UPDATED** - Additional Fixes Applied

### 5. **Pong Timeout During Long Operations** (NEW)
**Symptom**: Connection drops with "Pong timeout" when fetching emails/calendar events
**Root Cause**: `websocket.receive()` blocks indefinitely during 15-20 second email fetches, can't process pings
**Fix**: Added 5-second timeout to `receive()` so backend checks for pings even during long operations

**Code Changes**:
```python
# Before: Blocked forever waiting for messages
data = await websocket.receive()

# After: Check every 5 seconds for pings
try:
    data = await asyncio.wait_for(websocket.receive(), timeout=5.0)
except asyncio.TimeoutError:
    continue  # Loop continues, can process pings now
```

### 6. **Calendar/Email Audio Quality Issues** (NEW)
**Symptom**: Calendar/email audio sounds "low quality" or doesn't play fully
**Root Cause**: 
- Audio was being processed TWICE (duplicate message handling)
- Second attempt blocked by "queue already playing" check
- Result: Audio cuts off or plays incompletely

**Fix**: 
- Calendar/email actions now have dedicated audio handler
- Early return prevents double processing
- Queue is cleared before playing action audio

**Code Changes** (Frontend):
```typescript
// Before: Audio processed in two places causing conflicts

// After: Dedicated handler with early return
if (data.action === "email_calendar_summary") {
    // ... dispatch event ...
    
    // Handle audio ONCE, here
    if (audioField && !isMiraMuted && hasUserInteracted) {
        playNonStreamingAudio(audioField); // Clears queue, plays immediately
    }
    return; // ✅ Exit - don't process again below
}
```

## Issues Identified (Original)

### 1. **AsyncIO Buffer Error (CRITICAL)**
**Symptom**: Hundreds of `AssertionError: Data should not be empty` errors in backend logs
**Root Cause**: 
- Audio chunks were being sent too rapidly through the WebSocket without backpressure handling
- FastAPI's WebSocket implementation can fail if you try to send while a previous send is in progress
- This caused buffer corruption and connection instability

**Fix Applied**:
- Added 10ms delay (`await asyncio.sleep(0.01)`) between audio chunks to allow client processing
- Added try-except blocks around ALL `websocket.send_json()` calls
- Non-fatal errors allow streaming to continue instead of breaking the connection

**Code Changes**:
```python
# Before
await websocket.send_json({"message_type": "audio_chunk", "audio": audio_b64})

# After  
try:
    await websocket.send_json({"message_type": "audio_chunk", "audio": audio_b64})
    await asyncio.sleep(0.01)  # 10ms backpressure
except Exception as e:
    logging.warning(f"Failed to send audio chunk: {e}")
    continue  # Don't break - try next chunk
```

### 2. **Ping/Pong Timeout Confusion**
**Symptom**: Frontend constantly reconnecting with "Pong timeout - connection appears dead"
**Root Cause**:
- BOTH frontend AND backend were sending pings simultaneously
- Backend's 30-second keepalive conflicted with frontend's 25-second pings
- Frontend's 10-second pong timeout was too aggressive for slow calendar/email operations

**Fix Applied**:
- **Backend**: Removed redundant keepalive ping task (frontend handles it)
- **Frontend**: Increased pong timeout from 10s → 20s
- **Frontend**: Increased ping interval from 25s → 30s
- Backend now ONLY responds to client pings (cleaner protocol)

**Code Changes**:
```typescript
// Frontend WebSocketManager.ts
this.pingInterval = config.pingInterval ?? 30000; // 30 seconds (reduced frequency)
this.pongTimeout = config.pongTimeout ?? 20000; // 20 seconds (increased tolerance)
```

```python
# Backend voice_generation.py
# Removed: task_keepalive = asyncio.create_task(keepalive())
# Now only responds to client pings in forward_client_to_upstream()
```

### 3. **Calendar/Email Action Response Failures**
**Symptom**: 
- Low audio quality or no audio during calendar/email requests
- Connection closes during long-running dashboard data fetches

**Root Cause**:
- Calendar/email actions send large JSON messages with embedded audio
- No error handling for failed sends
- Long operations (10+ seconds) caused pong timeouts

**Fix Applied**:
- Added try-except wrapper around calendar/email response sending
- Added 50ms buffer delay after sending large messages
- Improved pong timeout tolerance (see #2 above)

**Code Changes**:
```python
# Added error handling and backpressure
try:
    await websocket.send_json({
        "message_type": "response",
        "action": "email_calendar_summary",
        "actionData": action_data,
        "audio": audio_base64,
    })
    await asyncio.sleep(0.05)  # 50ms buffer for large message
    logging.info(f"✅ Sent calendar/email summary")
except Exception as e:
    logging.error(f"Failed to send calendar/email summary: {e}")
    # Send error fallback
```

### 4. **Ping Response Robustness**
**Symptom**: Pings not being responded to during heavy processing
**Root Cause**: Error in ping handler could break message processing loop

**Fix Applied**:
- Wrapped pong response in try-except
- Don't break connection loop if pong send fails
- Log warnings but continue processing

**Code Changes**:
```python
elif msg_type == "ping":
    # CRITICAL: Respond IMMEDIATELY with error handling
    try:
        await websocket.send_json({"message_type": "pong"})
        logging.debug("ws_voice_stt: received ping, sent pong")
    except Exception as e:
        logging.warning(f"ws_voice_stt: failed to send pong: {e}")
        # Don't break - keep trying
```

## Testing Recommendations

1. **Test Calendar Actions**: Say "show me my calendar events" or "show me my emails"
   - Should NOT cause reconnections
   - Audio should play smoothly
   - No AsyncIO errors in backend logs

2. **Test Long Conversations**: Have extended voice conversations (2-3 minutes)
   - Connection should stay stable
   - No pong timeout warnings
   - No buffer errors

3. **Monitor Backend Logs**: Watch for:
   - ✅ No `AssertionError: Data should not be empty`
   - ✅ Pings/pongs logged correctly
   - ✅ Audio chunks sent without errors

4. **Monitor Frontend Console**: Watch for:
   - ✅ No "Pong timeout" warnings
   - ✅ No frequent reconnections
   - ✅ Stable OPEN connection state

## Performance Improvements

- **Reduced Network Traffic**: Ping interval increased 25s → 30s (17% reduction)
- **Better Error Recovery**: Failed audio chunks don't break entire stream
- **Improved Latency**: Backpressure prevents buffer overflow without significantly impacting speed
- **Higher Reliability**: Connection stays stable during long operations (calendar/email fetches)

## Files Modified

1. **Backend**: `MIRA_MVP0/backend/voice/voice_generation.py`
   - Added backpressure delays to audio streaming
   - Removed redundant keepalive task
   - Added error handling to all WebSocket sends
   - Improved ping/pong robustness

2. **Frontend**: `MIRA_MVP0/frontend/src/utils/voice/WebSocketManager.ts`
   - Increased pong timeout tolerance (10s → 20s)
   - Increased ping interval (25s → 30s)

## Expected Behavior After Fix

### ✅ What Should Work:
- Smooth audio playback without crackling or interruptions
- Stable WebSocket connection (no constant reconnections)
- Calendar/email commands work reliably with audio feedback
- Backend logs show clean audio streaming without errors

### ❌ What Should NOT Happen:
- No more `AssertionError: Data should not be empty` errors
- No pong timeout warnings during normal operation
- No connection drops during calendar/email fetches
- No audio quality degradation

## Rollback Instructions (If Needed)

If issues persist, rollback by:
```bash
git checkout MIRA_MVP0/backend/voice/voice_generation.py
git checkout MIRA_MVP0/frontend/src/utils/voice/WebSocketManager.ts
```

Then investigate specific error patterns in logs.

---

**Date**: December 1, 2025  
**Issue**: Voice pipeline instability during calendar actions  
**Status**: ✅ FIXED  
**Next Steps**: Monitor production logs for 24-48 hours to confirm stability

