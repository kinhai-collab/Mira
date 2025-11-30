// Realtime WebAudio -> WebSocket STT client
// - Captures microphone via getUserMedia
// - Mixes to mono, resamples to 16000 Hz, converts to PCM16 little-endian
// - Chunks into fixed-size byte frames (default 4096) and sends JSON messages:
//   { message_type: 'input_audio_chunk', audio_base_64: '<base64>', commit: false|true, sample_rate: 16000 }
// - Sends a final commit when stopped

import { WebSocketManager, ConnectionState } from './WebSocketManager';

type RealtimeOptions = {
  wsUrl?: string; // e.g. 'ws://127.0.0.1:8000/api/ws/voice-stt'
  token?: string | null;
  chunkSize?: number; // bytes per chunk
  onMessage?: (msg: unknown) => void;
  onOpen?: () => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (err: unknown) => void;
  onPartialResponse?: (text: string) => void;
  onAudioChunk?: (base64: string) => void;
  onAudioFinal?: () => void;
  onResponse?: (text: string, base64Audio?: string | null) => void;
  onStateChange?: (state: ConnectionState) => void;
};

export function arrayBufferToBase64(ab: ArrayBuffer): string {
  const chunkSize = 0x8000;
  const bytes = new Uint8Array(ab);
  let result = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    result += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(result);
}

function resampleFloat32ToInt16(input: Float32Array, inputRate: number, outputRate: number): Int16Array {
  if (input.length === 0) return new Int16Array(0);
  if (inputRate === outputRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return out;
  }
  const ratio = inputRate / outputRate;
  const newLength = Math.round(input.length / ratio);
  const out = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = idx - i0;
    const s0 = input[i0];
    const s1 = input[i1];
    const sample = s0 + (s1 - s0) * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return out;
}

export function createRealtimeSttClient(opts: RealtimeOptions = {}) {
  const {
    wsUrl = 'ws://127.0.0.1:8000/api/ws/voice-stt',
    token = null,
    chunkSize = 4096,
    onMessage,
    onOpen,
    onError,
    onStateChange,
  } = opts;
    
    // new streaming callbacks
    const onPartialResponse = opts.onPartialResponse;
    const onAudioChunk = opts.onAudioChunk;
    const onAudioFinal = opts.onAudioFinal;
    const onResponse = opts.onResponse;

  let wsManager: WebSocketManager | null = null;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let isStreaming = false;
  let bufferedBytes = new Uint8Array(0);
  // VAD (voice activity detection) state
  let lastSpeechTimestamp = 0;
  let committedDueToSilence = false;
  const silenceThreshold = 0.01; // RMS threshold roughly (tuneable)
  const silenceTimeoutMs = 1200; // commit after 1.2s of silence

  function appendBytes(newBytes: Uint8Array) {
    const tmp = new Uint8Array(bufferedBytes.length + newBytes.length);
    tmp.set(bufferedBytes, 0);
    tmp.set(newBytes, bufferedBytes.length);
    bufferedBytes = tmp;
  }

  function handleWebSocketMessage(parsed: Record<string, unknown>) {
    const msgType = parsed.message_type || parsed.type || parsed.event;
    
    // Debug: Log all incoming JSON messages
    console.log('[realtimeSttClient] 📨 JSON message:', {
      msgType,
      hasAudio: !!(parsed.audio || parsed.audio_base_64 || parsed.audio_base64),
      audioField: parsed.audio ? 'audio' : parsed.audio_base_64 ? 'audio_base_64' : parsed.audio_base64 ? 'audio_base64' : 'none',
      keys: Object.keys(parsed)
    });

    // Handle pong - already handled by WebSocketManager
    if (msgType === 'pong') {
      return;
    }

    // New handlers for incremental streaming responses/audio
    if (msgType === 'partial_response') {
      // Skip empty partial responses
      const text = typeof parsed.text === 'string' ? parsed.text : '';
      if (!text || !text.trim()) {
        return; // Don't process empty partial responses
      }
      console.log('[realtimeSttClient] 📝 partial_response detected');
      try { if (onPartialResponse) onPartialResponse(text); } catch {
        // Ignore errors in partial response handler
      }
    } else if (msgType === 'audio_chunk') {
      // support both `audio_base_64` and `audio` field names
      const audioB64 = parsed.audio_base_64 || parsed.audio || parsed.audio_base64 || null;
      console.log('[realtimeSttClient] 🔊 audio_chunk detected! Has audio:', !!audioB64, 'Length:', audioB64?.length || 0);
      try { if (onAudioChunk && audioB64) onAudioChunk(audioB64); } catch (error) { console.error('[realtimeSttClient] onAudioChunk error:', error); }
    } else if (msgType === 'audio_final') {
      console.log('[realtimeSttClient] 🏁 audio_final detected!');
      try { if (onAudioFinal) onAudioFinal(); } catch (error) { console.error('[realtimeSttClient] onAudioFinal error:', error); }
    } else if (msgType === 'response') {
      const audioB64 = parsed.audio_base_64 || parsed.audio || parsed.audio_base64 || null;
      // Only log response details if it has action or is important
      if (parsed.action || !audioB64) {
        console.log('[realtimeSttClient] 💬 response detected! Has audio:', !!audioB64, 'Has action:', !!parsed.action);
      }
      const responseText = typeof parsed.text === 'string' ? parsed.text : '';
      try { if (onResponse) onResponse(responseText, audioB64); } catch (error) { console.error('[realtimeSttClient] onResponse error:', error); }
      // Note: Full parsed object (with action/actionData) is automatically forwarded to onMessage below
      // since 'response' is not in the alreadyHandled list
    }

    // Existing STT/transcript and server message handling
    if (msgType === 'session_started') {
      console.log('[realtimeSttClient] ✅ ElevenLabs session started:', {
        session_id: parsed.session_id,
        sample_rate: parsed.config?.sample_rate,
        audio_format: parsed.config?.audio_format,
      });
    } else if (msgType === 'partial_transcript' || msgType === 'transcription' || msgType === 'partial_transcription') {
      // support `transcription` message_type forwarded from backend (partial or final)
      // Reduced logging - partial transcripts are noisy
      try { if (onMessage) onMessage(parsed); } catch {
        // Ignore errors in message handler
      }
    } else if (msgType === 'committed_transcript' || msgType === 'committed_transcript_with_timestamps' || msgType === 'transcription' || msgType === 'transcribed' || msgType === 'final_transcript') {
      const transcriptText = (typeof parsed.text === 'string' ? parsed.text : null) || (typeof parsed.partial === 'string' ? parsed.partial : null) || null;
      // Skip empty/null transcripts to prevent glitches
      if (!transcriptText || !transcriptText.trim()) {
        console.debug('[realtimeSttClient] ⏭️ Skipping empty committed transcript');
        return; // Don't forward empty transcripts - exit early
      }
      // Only log if transcript is meaningful (not fragments from VAD splitting)
      if (transcriptText.length > 10) {
        console.log('[realtimeSttClient] ✅ Committed transcript:', transcriptText);
      } else {
        console.debug('[realtimeSttClient] 📝 Short transcript (likely fragment):', transcriptText);
      }
      // Forward valid transcript to onMessage handler
      try { if (onMessage) onMessage(parsed); } catch {
        // Ignore errors in message handler
      }
      return; // Don't forward again at the end
    } else if (msgType === 'error') {
      console.error('[realtimeSttClient] ElevenLabs error:', parsed.error);
    } else if (msgType === 'quota_exceeded_error') {
      console.error('[realtimeSttClient] ⚠️ ElevenLabs quota exceeded:', parsed.error);
    }

    // Check for errors - distinguish between server errors and ElevenLabs (upstream) errors
    if (parsed.error || msgType === 'auth_error' || parsed.error_message) {
      const errorMsg = parsed.error || parsed.message || parsed.error_message || 'Unknown error';

      if (msgType === 'auth_error' || errorMsg.includes('authenticated') || errorMsg.includes('ElevenLabs')) {
        console.error('[realtimeSttClient] ⚠️ ElevenLabs authentication error (upstream):', errorMsg);
        console.error('[realtimeSttClient] This means the server\'s ELEVENLABS_API_KEY is missing, invalid, or expired.');
        console.error('[realtimeSttClient] Check: 1) Server .env has ELEVENLABS_API_KEY=sk_... 2) Server was restarted after .env changes 3) Key is valid for ElevenLabs realtime STT');
      } else {
        console.error('[realtimeSttClient] Server error:', errorMsg);
      }
    }

    // Forward the raw parsed message to the general onMessage handler
    // BUT skip if we've already handled it above (committed_transcript, partial_response, etc.)
    // This prevents duplicate processing
    const alreadyHandled = (
      msgType === 'committed_transcript' || 
      msgType === 'committed_transcript_with_timestamps' || 
      msgType === 'transcription' || 
      msgType === 'transcribed' || 
      msgType === 'final_transcript' ||
      msgType === 'partial_response'
    );
    
    if (!alreadyHandled) {
      try { 
        if (onMessage) {
          onMessage(parsed);
        }
      } catch {
        // Ignore errors in message handler
      }
    }
  }

  async function ensureWebSocket() {
    if (wsManager && wsManager.isReady()) return;
    
    // Don't connect if document is not ready
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      console.warn('[realtimeSttClient] Skipping WebSocket connection - document still loading');
      return;
    }
    
    console.log('[realtimeSttClient] Creating WebSocket connection...');
    
    // Create WebSocketManager with automatic reconnection
    wsManager = new WebSocketManager({
      wsUrl,
      token,
      onMessage: (data) => {
        try {
          // Handle both parsed JSON and raw data
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              handleWebSocketMessage(parsed);
            } catch {
              console.log('[realtimeSttClient] Received non-JSON message:', data);
              if (onMessage) {
                onMessage(data);
              }
            }
          } else if (data instanceof ArrayBuffer) {
            // Binary audio data
            console.log('[realtimeSttClient] Received binary message, length:', data.byteLength);
            try {
              const b64 = arrayBufferToBase64(data);
              if (onAudioChunk) {
                try { onAudioChunk(b64); } catch {
                  // Ignore errors in audio chunk handler
                }
              }
              if (onMessage) {
                try { onMessage({ message_type: 'audio_chunk', audio_base_64: b64 }); } catch {
                  // Ignore errors in message handler
                }
              }
            } catch (error) {
              console.warn('[realtimeSttClient] Failed to convert binary audio to base64', error);
              if (onMessage) {
                onMessage(data);
              }
            }
          } else if (typeof data === 'object') {
            // Already parsed JSON
            handleWebSocketMessage(data);
          }
        } catch (error) {
          console.error('[realtimeSttClient] Error handling message:', error);
        }
      },
      onStateChange: (state) => {
        console.log('[realtimeSttClient] Connection state:', state);
        if (onStateChange) {
          onStateChange(state);
        }
        if (state === ConnectionState.OPEN) {
          // Send auth message when connected
          if (token) {
            try {
              const authMsg = { type: 'authorization', token };
              console.log('[realtimeSttClient] Sending auth message');
              wsManager?.send(authMsg);
            } catch (error) {
              console.error('[realtimeSttClient] Failed to send auth message', error);
            }
          }
          if (onOpen) {
            onOpen();
          }
        }
      },
      onError: (err) => {
        console.error('[realtimeSttClient] WebSocket error:', err);
        if (onError) {
          onError(err);
        }
      },
      maxReconnectAttempts: 10,
      initialReconnectDelay: 1000,
      pingInterval: 25000,
      pongTimeout: 10000,
    });

    await wsManager.connect();
  }

  async function start() {
    if (isStreaming) return;
    isStreaming = true;
    bufferedBytes = new Uint8Array(0);

    await ensureWebSocket();

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
    audioCtx = new AudioCtx();
    if (!audioCtx) throw new Error('Failed to create AudioContext');
    sourceNode = audioCtx.createMediaStreamSource(stream);

    const inputSampleRate = audioCtx.sampleRate || 48000;
    const procBufferSize = 4096;
    processor = audioCtx.createScriptProcessor(procBufferSize, sourceNode.channelCount || 1, 1);

    processor.onaudioprocess = (ev: AudioProcessingEvent) => {
      try {
        const inBuf = ev.inputBuffer;
        const numCh = inBuf.numberOfChannels;
        const length = inBuf.length;
        const mono = new Float32Array(length);
        if (numCh === 1) mono.set(inBuf.getChannelData(0));
        else {
          for (let c = 0; c < numCh; c++) {
            const ch = inBuf.getChannelData(c);
            for (let i = 0; i < length; i++) mono[i] += ch[i] / numCh;
          }
        }

        // Simple VAD: compute RMS on the mono buffer
        try {
          let sum = 0;
          for (let i = 0; i < mono.length; i++) {
            const s = mono[i];
            sum += s * s;
          }
          const rms = Math.sqrt(sum / Math.max(1, mono.length));
          const now = Date.now();
          if (rms > silenceThreshold) {
            lastSpeechTimestamp = now;
            // user spoke again, allow future commits
            committedDueToSilence = false;
          } else {
            // If we've been silent long enough, auto-commit
            if (lastSpeechTimestamp > 0 && now - lastSpeechTimestamp > silenceTimeoutMs && !committedDueToSilence) {
              committedDueToSilence = true;
              // Flush any buffered chunks and send a final commit; do not close the WS
                void (async () => {
                try {
                  await flushChunks(true);
                  try {
                    if (wsManager && wsManager.isReady()) {
                      wsManager.send({ type: 'transcribe', response_format: 'verbose' });
                    }
                  } catch {
                    // Ignore errors when sending transcribe message
                  }
                } catch (error) {
                  if (onError) {
                    onError(error);
                  }
                }
              })();
            }
          }
        } catch {
          // continue if VAD fails
        }

        const int16 = resampleFloat32ToInt16(mono, inputSampleRate, 16000);
        const bytes = new Uint8Array(int16.buffer);
        // append to internal buffer and attempt to send slices
        appendBytes(bytes);
        void flushChunks(false);
      } catch (err) {
        onError && onError(err);
      }
    };

    sourceNode.connect(processor);
    processor.connect(audioCtx.destination);
  }

  async function flushChunks(commit: boolean) {
    if (!wsManager || !wsManager.isReady()) return;
    while (bufferedBytes.length >= chunkSize) {
      const chunk = bufferedBytes.subarray(0, chunkSize);
      bufferedBytes = bufferedBytes.subarray(chunkSize);
      await sendChunk(chunk.buffer, false);
    }
    if (commit) {
      // Send any remaining buffered bytes with commit: false
      if (bufferedBytes.length > 0) {
        const final = bufferedBytes;
        bufferedBytes = new Uint8Array(0);
        await sendChunk(final.buffer, false);
      }
      // Then send the final empty commit message
      await sendChunk(new ArrayBuffer(0), true);
    }
  }

  async function sendChunk(ab: ArrayBuffer, commit: boolean) {
    if (!wsManager || !wsManager.isReady()) {
      console.warn('[realtimeSttClient] Cannot send chunk - WebSocket not ready');
      return;
    }
    const b64 = commit ? '' : arrayBufferToBase64(ab); // Empty string for final commit chunk
    const msg = {
      message_type: 'input_audio_chunk',
      audio_base_64: b64,
      commit: !!commit,
      sample_rate: 16000,
    };
    try {
      if (commit || ab.byteLength > 0) {
        console.debug('[realtimeSttClient] Sending chunk:', {
          commit,
          audioLength: ab.byteLength,
          b64Length: b64.length,
        });
      }
      wsManager.send(msg);
      } catch (error) {
        console.error('[realtimeSttClient] Error sending chunk:', error);
        if (onError) {
          onError(error);
        }
        return;
      }
    // Note: WebSocketManager doesn't expose bufferedAmount, but it has internal queue management
    // backpressure is handled by the manager
    await new Promise((r) => setTimeout(r, 10)); // Small delay for flow control
  }

  async function stop() {
    if (!isStreaming) return;
    isStreaming = false;
    try {
      // flush and send final commit (empty audio_base_64 with commit:true)
      await flushChunks(true);
      // Optionally request transcription after commit
      try { 
        if (wsManager && wsManager.isReady()) {
          wsManager.send({ type: 'transcribe', response_format: 'verbose' }); 
        }
      } catch {}
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }

    try {
      if (processor) {
        try { processor.disconnect(); } catch {}
        processor.onaudioprocess = null as unknown as ((this: ScriptProcessorNode, ev: AudioProcessingEvent) => void) | null;
        processor = null;
      }
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch {
          // Ignore disconnect errors
        }
        sourceNode = null;
      }
      if (audioCtx) {
        try { await audioCtx.close(); } catch {}
        audioCtx = null;
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
    } catch {
      // swallow
    }

    try {
      if (wsManager) {
        // Disable auto-reconnect when stopping - only reconnect if user explicitly starts voice again
        wsManager.close(true); // Close and prevent auto-reconnection
        wsManager = null;
      }
    } catch {}
  }

  return {
    start,
    stop,
    getWebSocket: () => wsManager,
    send: (data: unknown) => wsManager?.send(data),
    forceReconnect: () => wsManager?.forceReconnect(),
  };
}
