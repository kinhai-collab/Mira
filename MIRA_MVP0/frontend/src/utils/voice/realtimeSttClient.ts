// Realtime WebAudio -> WebSocket STT client
// - Captures microphone via getUserMedia with optimized constraints
// - Uses AudioWorklet for low-latency, glitch-free processing (with ScriptProcessor fallback)
// - Mixes to mono, resamples to 16000 Hz, converts to PCM16 little-endian
// - Chunks into fixed-size byte frames (default 4096) and sends JSON messages:
//   { message_type: 'input_audio_chunk', audio_base_64: '<base64>', commit: false|true, sample_rate: 16000 }
// - Sends a final commit when stopped

import { WebSocketManager, ConnectionState } from './WebSocketManager';
import { normalizeWebSocketUrl } from './websocketUrl';

type RealtimeOptions = {
  wsUrl?: string;
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
  onVAD?: (speaking: boolean, rms: number) => void;
};

// Optimized audio constraints for voice input
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // Request specific sample rate if supported
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
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

// Legacy resampling function for ScriptProcessor fallback
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
    wsUrl: rawWsUrl = 'ws://127.0.0.1:8000/api/ws/voice-stt',
    token = null,
    chunkSize = 4096,
    onMessage,
    onOpen,
    onError,
    onStateChange,
    onVAD,
  } = opts;
  
  const wsUrl = normalizeWebSocketUrl(rawWsUrl);
  const onPartialResponse = opts.onPartialResponse;
  const onAudioChunk = opts.onAudioChunk;
  const onAudioFinal = opts.onAudioFinal;
  const onResponse = opts.onResponse;

  let wsManager: WebSocketManager | null = null;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  
  // AudioWorklet nodes
  let workletNode: AudioWorkletNode | null = null;
  
  // Fallback ScriptProcessor nodes
  let processor: ScriptProcessorNode | null = null;
  
  let isStreaming = false;
  let bufferedBytes = new Uint8Array(0);
  let useWorklet = false;
  
  // VAD state for fallback mode
  let lastSpeechTimestamp = 0;
  let committedDueToSilence = false;
  const silenceThreshold = 0.008; // Tuned threshold
  const silenceTimeoutMs = 1200;

  function appendBytes(newBytes: Uint8Array) {
    // Efficient buffer management - reuse when possible
    const tmp = new Uint8Array(bufferedBytes.length + newBytes.length);
    tmp.set(bufferedBytes, 0);
    tmp.set(newBytes, bufferedBytes.length);
    bufferedBytes = tmp;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function handleWebSocketMessage(parsed: Record<string, unknown>) {
    const msgType = parsed.message_type || parsed.type || parsed.event;

    if (msgType === 'pong') return;

    // Handle streaming responses
    if (msgType === 'partial_response') {
      const text = typeof parsed.text === 'string' ? parsed.text : '';
      if (!text || !text.trim()) return;
      try { if (onPartialResponse) onPartialResponse(text); } catch { /* ignore */ }
    } else if (msgType === 'audio_chunk') {
      const audioB64 = (typeof parsed.audio_base_64 === 'string' ? parsed.audio_base_64 : null) ||
                       (typeof parsed.audio === 'string' ? parsed.audio : null) ||
                       (typeof parsed.audio_base64 === 'string' ? parsed.audio_base64 : null);
      try { if (onAudioChunk && audioB64) onAudioChunk(audioB64); } catch (e) { console.error('[realtimeSttClient] onAudioChunk error:', e); }
    } else if (msgType === 'audio_final') {
      try { if (onAudioFinal) onAudioFinal(); } catch (e) { console.error('[realtimeSttClient] onAudioFinal error:', e); }
    } else if (msgType === 'response') {
      const audioB64 = (typeof parsed.audio_base_64 === 'string' ? parsed.audio_base_64 : null) ||
                       (typeof parsed.audio === 'string' ? parsed.audio : null) ||
                       (typeof parsed.audio_base64 === 'string' ? parsed.audio_base64 : null);
      const responseText = typeof parsed.text === 'string' ? parsed.text : '';
      try { if (onResponse) onResponse(responseText, audioB64); } catch (e) { console.error('[realtimeSttClient] onResponse error:', e); }
    }

    // Handle transcripts
    if (msgType === 'session_started') {
      // Session ready
    } else if (msgType === 'partial_transcript' || msgType === 'transcription' || msgType === 'partial_transcription') {
      try { if (onMessage) onMessage(parsed); } catch { /* ignore */ }
    } else if (msgType === 'committed_transcript' || msgType === 'committed_transcript_with_timestamps' || 
               msgType === 'transcribed' || msgType === 'final_transcript') {
      const transcriptText = (typeof parsed.text === 'string' ? parsed.text : null) || 
                            (typeof parsed.partial === 'string' ? parsed.partial : null);
      if (!transcriptText || !transcriptText.trim()) return;
      try { if (onMessage) onMessage(parsed); } catch { /* ignore */ }
      return;
    }

    // Handle errors
    if (parsed.error || msgType === 'auth_error' || parsed.error_message) {
      const errorMsg = typeof parsed.error === 'string' ? parsed.error :
                       typeof parsed.message === 'string' ? parsed.message :
                       typeof parsed.error_message === 'string' ? parsed.error_message :
                       'Unknown error';
      if (msgType === 'auth_error' || errorMsg.includes('authenticated') || errorMsg.includes('ElevenLabs')) {
        console.error('[realtimeSttClient] ElevenLabs auth error:', errorMsg);
      } else {
        console.error('[realtimeSttClient] Server error:', errorMsg);
      }
    }

    // Forward unhandled messages
    const alreadyHandled = (
      msgType === 'committed_transcript' || 
      msgType === 'committed_transcript_with_timestamps' || 
      msgType === 'transcription' || 
      msgType === 'transcribed' || 
      msgType === 'final_transcript' ||
      msgType === 'partial_response'
    );
    
    if (!alreadyHandled) {
      try { if (onMessage) onMessage(parsed); } catch { /* ignore */ }
    }
  }

  async function ensureWebSocket() {
    if (wsManager && wsManager.isReady()) return;
    
    if (typeof document !== 'undefined' && document.readyState === 'loading') return;
    
    wsManager = new WebSocketManager({
      wsUrl,
      token,
      onMessage: (data) => {
        try {
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              handleWebSocketMessage(parsed);
            } catch {
              if (onMessage) onMessage(data);
            }
          } else if (data instanceof ArrayBuffer) {
            const b64 = arrayBufferToBase64(data);
            if (onAudioChunk) {
              try { onAudioChunk(b64); } catch { /* ignore */ }
            }
            if (onMessage) {
              try { onMessage({ message_type: 'audio_chunk', audio_base_64: b64 }); } catch { /* ignore */ }
            }
          } else if (isRecord(data)) {
            handleWebSocketMessage(data);
          }
        } catch (error) {
          console.error('[realtimeSttClient] Error handling message:', error);
        }
      },
      onStateChange: (state) => {
        if (onStateChange) onStateChange(state);
        if (state === ConnectionState.OPEN) {
          if (token) {
            try {
              wsManager?.send({ type: 'authorization', token });
            } catch (e) {
              console.error('[realtimeSttClient] Failed to send auth:', e);
            }
          }
          if (onOpen) onOpen();
        }
      },
      onError: (err) => {
        console.error('[realtimeSttClient] WebSocket error:', err);
        if (onError) onError(err);
      },
      maxReconnectAttempts: 10,
      initialReconnectDelay: 1000,
      pingInterval: 25000,
      pongTimeout: 10000,
    });

    await wsManager.connect();
  }

  async function initAudioWorklet(ctx: AudioContext): Promise<boolean> {
    try {
      // Check if AudioWorklet is supported
      if (!ctx.audioWorklet) {
        console.log('[realtimeSttClient] AudioWorklet not supported, using fallback');
        return false;
      }
      
      await ctx.audioWorklet.addModule('/audio-processor.worklet.js');
      return true;
    } catch (e) {
      console.warn('[realtimeSttClient] AudioWorklet init failed, using fallback:', e);
      return false;
    }
  }

  async function start() {
    if (isStreaming) return;
    isStreaming = true;
    bufferedBytes = new Uint8Array(0);
    lastSpeechTimestamp = 0;
    committedDueToSilence = false;

    await ensureWebSocket();

    // Get microphone with optimized constraints
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: AUDIO_CONSTRAINTS 
      });
    } catch (e) {
      // Fallback to basic audio if constraints fail
      console.warn('[realtimeSttClient] Advanced audio constraints failed, using basic:', e);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const AudioCtx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
    audioCtx = new AudioCtx();
    if (!audioCtx) throw new Error('Failed to create AudioContext');
    
    sourceNode = audioCtx.createMediaStreamSource(stream);
    const inputSampleRate = audioCtx.sampleRate || 48000;

    // Try to use AudioWorklet first
    useWorklet = await initAudioWorklet(audioCtx);
    
    if (useWorklet) {
      // Modern path: AudioWorklet (runs on separate thread)
      workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor', {
        processorOptions: {
          targetSampleRate: 16000,
          silenceThreshold: silenceThreshold,
          silenceTimeoutMs: silenceTimeoutMs,
        }
      });
      
      workletNode.port.onmessage = async (event) => {
        const { type, pcm16, rms, speaking } = event.data;
        
        if (type === 'vad' && onVAD) {
          onVAD(speaking, rms);
        } else if (type === 'silenceCommit') {
          // Auto-commit on silence
          try {
            await flushChunks(true);
            if (wsManager && wsManager.isReady()) {
              wsManager.send({ type: 'transcribe', response_format: 'verbose' });
            }
          } catch (e) {
            if (onError) onError(e);
          }
        } else if (type === 'audio' && pcm16) {
          // Received PCM16 audio data
          const bytes = new Uint8Array(pcm16);
          appendBytes(bytes);
          void flushChunks(false);
        }
      };
      
      sourceNode.connect(workletNode);
      workletNode.connect(audioCtx.destination);
      
    } else {
      // Fallback path: ScriptProcessorNode (deprecated but widely supported)
      const procBufferSize = 4096;
      processor = audioCtx.createScriptProcessor(procBufferSize, sourceNode.channelCount || 1, 1);

      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        try {
          const inBuf = ev.inputBuffer;
          const numCh = inBuf.numberOfChannels;
          const length = inBuf.length;
          const mono = new Float32Array(length);
          
          if (numCh === 1) {
            mono.set(inBuf.getChannelData(0));
          } else {
            for (let c = 0; c < numCh; c++) {
              const ch = inBuf.getChannelData(c);
              for (let i = 0; i < length; i++) mono[i] += ch[i] / numCh;
            }
          }

          // VAD
          let sum = 0;
          for (let i = 0; i < mono.length; i++) {
            sum += mono[i] * mono[i];
          }
          const rms = Math.sqrt(sum / Math.max(1, mono.length));
          const now = Date.now();
          
          if (rms > silenceThreshold) {
            lastSpeechTimestamp = now;
            committedDueToSilence = false;
            if (onVAD) onVAD(true, rms);
          } else {
            if (lastSpeechTimestamp > 0 && now - lastSpeechTimestamp > silenceTimeoutMs && !committedDueToSilence) {
              committedDueToSilence = true;
              void (async () => {
                try {
                  await flushChunks(true);
                  if (wsManager && wsManager.isReady()) {
                    wsManager.send({ type: 'transcribe', response_format: 'verbose' });
                  }
                } catch (e) {
                  if (onError) onError(e);
                }
              })();
            }
          }

          const int16 = resampleFloat32ToInt16(mono, inputSampleRate, 16000);
          const bytes = new Uint8Array(int16.buffer);
          appendBytes(bytes);
          void flushChunks(false);
        } catch (err) {
          if (onError) onError(err);
        }
      };

      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);
    }
  }

  async function flushChunks(commit: boolean) {
    if (!wsManager || !wsManager.isReady()) return;
    
    while (bufferedBytes.length >= chunkSize) {
      const chunk = bufferedBytes.subarray(0, chunkSize);
      bufferedBytes = bufferedBytes.subarray(chunkSize);
      await sendChunk(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength), false);
    }
    
    if (commit) {
      if (bufferedBytes.length > 0) {
        const final = bufferedBytes;
        bufferedBytes = new Uint8Array(0);
        await sendChunk(final.buffer.slice(final.byteOffset, final.byteOffset + final.byteLength), false);
      }
      await sendChunk(new ArrayBuffer(0), true);
    }
  }

  async function sendChunk(ab: ArrayBuffer, commit: boolean) {
    if (!wsManager || !wsManager.isReady()) return;
    
    const b64 = commit ? '' : arrayBufferToBase64(ab);
    const msg = {
      message_type: 'input_audio_chunk',
      audio_base_64: b64,
      commit: !!commit,
      sample_rate: 16000,
    };
    
    try {
      wsManager.send(msg);
    } catch (error) {
      console.error('[realtimeSttClient] Error sending chunk:', error);
      if (onError) onError(error);
      return;
    }
    
    // Small delay for flow control
    await new Promise((r) => setTimeout(r, 5));
  }

  async function stop() {
    if (!isStreaming) return;
    isStreaming = false;
    
    try {
      await flushChunks(true);
      if (wsManager && wsManager.isReady()) {
        wsManager.send({ type: 'transcribe', response_format: 'verbose' });
      }
    } catch (error) {
      if (onError) onError(error);
    }

    // Cleanup AudioWorklet
    if (workletNode) {
      try {
        workletNode.port.postMessage({ type: 'reset' });
        workletNode.disconnect();
      } catch { /* ignore */ }
      workletNode = null;
    }
    
    // Cleanup ScriptProcessor
    if (processor) {
      try { processor.disconnect(); } catch { /* ignore */ }
      processor.onaudioprocess = null as unknown as ((this: ScriptProcessorNode, ev: AudioProcessingEvent) => void) | null;
      processor = null;
    }
    
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch { /* ignore */ }
      sourceNode = null;
    }
    
    if (audioCtx) {
      try { await audioCtx.close(); } catch { /* ignore */ }
      audioCtx = null;
    }
    
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    if (wsManager) {
      wsManager.close(true);
      wsManager = null;
    }
  }

  return {
    start,
    stop,
    getWebSocket: () => wsManager,
    send: (data: unknown) => wsManager?.send(data),
    forceReconnect: () => wsManager?.forceReconnect(),
  };
}

