/*
WebSocket STT streamer
- Connects to ws://127.0.0.1:8000/ws/voice-stt by default (or use options.wsUrl)
- Uses AudioWorklet for low-latency processing (with ScriptProcessor fallback)
- Sends JSON text messages: {"message_type":"input_audio_chunk","audio_base_64":"<base64>","commit":false,"sample_rate":16000}
- When finished sends commit message with empty audio_base_64
- Then requests transcription: {"type":"transcribe","response_format":"verbose"}
- Calls onTranscript callback for text frames sent by server
*/

import { normalizeWebSocketUrl, getWebSocketUrl } from './websocketUrl';

type Options = {
  wsUrl?: string;
  token?: string | null;
  chunkSize?: number;
  mediaRecorderTimeslice?: number;
  mimeType?: string;
  onTranscript?: (msg: unknown) => void;
  onOpen?: () => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (err: unknown) => void;
  onProgress?: (sentBytes: number, totalBuffered: number) => void;
  onVAD?: (speaking: boolean, rms: number) => void;
};

// Optimized audio constraints
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};

export function arrayBufferToBase64(ab: ArrayBuffer): string {
  const chunkSize = 0x8000;
  const uint8 = new Uint8Array(ab);
  let result = '';
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const slice = uint8.subarray(i, Math.min(i + chunkSize, uint8.length));
    result += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(result);
}

// Decode an encoded audio Blob to PCM16@targetRate
export async function decodeAudioBlobToPCM16(blob: Blob, targetRate = 16000): Promise<ArrayBuffer> {
  if (!blob || blob.size === 0) throw new Error('decodeAudioBlobToPCM16: empty blob');
  const ab = await blob.arrayBuffer();
  const AudioCtx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const ac = new AudioCtx();
  
  try {
    const decoded: AudioBuffer = await new Promise((resolve, reject) => {
      try {
        const p = ac.decodeAudioData(ab.slice(0));
        if (p && typeof (p as Promise<AudioBuffer>).then === 'function') {
          (p as Promise<AudioBuffer>).then(resolve).catch(reject);
        } else {
          (ac as unknown as { decodeAudioData: (buffer: ArrayBuffer, successCallback: (decodedData: AudioBuffer) => void, errorCallback: (error: DOMException) => void) => void }).decodeAudioData(ab.slice(0), resolve, reject);
        }
      } catch (err) {
        reject(err);
      }
    });

    const numChannels = decoded.numberOfChannels;
    let sourceBuffer: AudioBuffer = decoded;

    if (decoded.sampleRate !== targetRate) {
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
      const src = offline.createBufferSource();
      const tmp = offline.createBuffer(1, decoded.length, decoded.sampleRate);
      const out = tmp.getChannelData(0);
      for (let c = 0; c < numChannels; c++) {
        const ch = decoded.getChannelData(c);
        for (let i = 0; i < ch.length; i++) out[i] = (out[i] || 0) + ch[i] / numChannels;
      }
      src.buffer = tmp;
      src.connect(offline.destination);
      src.start(0);
      sourceBuffer = await offline.startRendering();
    } else if (numChannels > 1) {
      const tmp = ac.createBuffer(1, decoded.length, decoded.sampleRate);
      const out = tmp.getChannelData(0);
      for (let c = 0; c < numChannels; c++) {
        const ch = decoded.getChannelData(c);
        for (let i = 0; i < ch.length; i++) out[i] = (out[i] || 0) + ch[i] / numChannels;
      }
      sourceBuffer = tmp;
    }

    const float32 = sourceBuffer.getChannelData(0);
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    try { ac.close(); } catch { /* ignore */ }
    return pcm16.buffer;
  } catch (err) {
    try { ac.close(); } catch { /* ignore */ }
    throw err;
  }
}

// Resampling function
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
    const sample = input[i0] + (input[i1] - input[i0]) * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return out;
}

export async function startWsVoiceStt(options: Options = {}) {
  const {
    token = null,
    chunkSize = 4096,
    onTranscript,
    onOpen,
    onClose,
    onError,
    onProgress,
    onVAD,
  } = options;

  const defaultWs = getWebSocketUrl('ws://127.0.0.1:8000/api/ws/voice-stt');
  const connectUrl = normalizeWebSocketUrl((options.wsUrl && options.wsUrl.length > 0) ? options.wsUrl : defaultWs);

  let ws: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let buffer = new Uint8Array(0);
  let sentBytes = 0;
  let socketOpen = false;
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let useWorklet = false;
  
  // VAD state
  let lastSpeechTimestamp = 0;
  let committedDueToSilence = false;
  const silenceThreshold = 0.008;
  const silenceTimeoutMs = 1200;

  function appendToBuffer(newBuf: Uint8Array) {
    const tmp = new Uint8Array(buffer.length + newBuf.length);
    tmp.set(buffer, 0);
    tmp.set(newBuf, buffer.length);
    buffer = tmp;
  }

  async function processBuffer(flush = false) {
    if (!socketOpen) return;

    while (buffer.length >= chunkSize) {
      const chunk = buffer.subarray(0, chunkSize);
      buffer = buffer.subarray(chunkSize);
      await sendAppendChunk(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength), false);
    }
    
    if (flush) {
      if (buffer.length > 0) {
        const final = buffer;
        buffer = new Uint8Array(0);
        await sendAppendChunk(final.buffer.slice(final.byteOffset, final.byteOffset + final.byteLength), false);
      }
      await sendAppendChunk(new ArrayBuffer(0), true);
    }
    if (onProgress) onProgress(sentBytes, buffer.length);
  }

  async function sendAppendChunk(ab: ArrayBuffer, commit: boolean) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !socketOpen) {
      if (onError) onError({ message: 'WebSocket is not open' });
      return;
    }

    const b64 = commit ? '' : arrayBufferToBase64(ab);
    const msg = {
      message_type: 'input_audio_chunk',
      audio_base_64: b64,
      commit: !!commit,
      sample_rate: 16000,
    };
    
    try {
      ws.send(JSON.stringify(msg));
      sentBytes += ab.byteLength;
    } catch (e) {
      if (onError) onError(e);
      return;
    }

    // Backpressure handling
    while (ws.bufferedAmount > 256 * 1024) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  function sendTranscribe() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: 'transcribe', response_format: 'verbose' }));
    } catch (e) {
      console.error('Failed to send transcribe request', e);
    }
  }

  function handleServerMessage(evt: MessageEvent) {
    if (typeof evt.data === 'string') {
      try {
        const parsed = JSON.parse(evt.data);
        if (onTranscript) onTranscript(parsed);
      } catch {
        if (onTranscript) onTranscript(evt.data);
      }
    }
  }

  async function initAudioWorklet(ctx: AudioContext): Promise<boolean> {
    try {
      if (!ctx.audioWorklet) return false;
      await ctx.audioWorklet.addModule('/audio-processor.worklet.js');
      return true;
    } catch (e) {
      console.warn('[wsVoiceStt] AudioWorklet init failed, using fallback:', e);
      return false;
    }
  }

  async function initWebSocket() {
    return new Promise<void>((resolve, reject) => {
      try {
        let urlToUse = connectUrl;
        if (token && !/([?&])token=/.test(connectUrl)) {
          const sep = connectUrl.includes('?') ? '&' : '?';
          urlToUse = `${connectUrl}${sep}token=${encodeURIComponent(token)}`;
        }

        ws = new WebSocket(urlToUse);
        ws.binaryType = 'arraybuffer';

        const openTimeoutMs = 5000;
        let didOpen = false;
        const openTimer = setTimeout(() => {
          if (!didOpen) {
            try { ws?.close(); } catch { /* ignore */ }
            if (onError) onError({ message: 'WebSocket open timeout', url: connectUrl });
            reject({ message: 'WebSocket open timeout' });
          }
        }, openTimeoutMs);

        ws.onopen = () => {
          didOpen = true;
          clearTimeout(openTimer);
          socketOpen = true;
          
          if (token) {
            try {
              ws?.send(JSON.stringify({ type: 'authorization', token }));
            } catch { /* ignore */ }
          }
          
          ws!.onmessage = handleServerMessage;
          ws!.onclose = (ev) => {
            socketOpen = false;
            if (onClose) onClose(ev);
            void stop();
          };
          
          if (onOpen) onOpen();
          resolve();
        };

        ws.onerror = (err) => {
          socketOpen = false;
          if (onError) onError({ message: 'WebSocket error', url: connectUrl });
          if (!didOpen) {
            clearTimeout(openTimer);
            try { ws?.close(); } catch { /* ignore */ }
            reject({ message: 'WebSocket error' });
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async function start() {
    sentBytes = 0;
    buffer = new Uint8Array(0);
    lastSpeechTimestamp = 0;
    committedDueToSilence = false;

    await initWebSocket();

    // Get microphone with optimized constraints
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const AudioCtx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
    audioContext = new AudioCtx();
    sourceNode = audioContext.createMediaStreamSource(stream);
    const inputSampleRate = audioContext.sampleRate || 48000;

    // Try AudioWorklet first
    useWorklet = await initAudioWorklet(audioContext);

    if (useWorklet) {
      workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor', {
        processorOptions: {
          targetSampleRate: 16000,
          silenceThreshold,
          silenceTimeoutMs,
        }
      });
      
      workletNode.port.onmessage = async (event) => {
        const { type, pcm16, rms, speaking } = event.data;
        
        if (type === 'vad' && onVAD) {
          onVAD(speaking, rms);
        } else if (type === 'silenceCommit') {
          try {
            await processBuffer(true);
            sendTranscribe();
          } catch (e) {
            if (onError) onError(e);
          }
        } else if (type === 'audio' && pcm16) {
          appendToBuffer(new Uint8Array(pcm16));
          void processBuffer(false).catch((err) => {
            if (onError) onError(err);
          });
        }
      };
      
      sourceNode.connect(workletNode);
      workletNode.connect(audioContext.destination);
    } else {
      // Fallback: ScriptProcessor
      const processorBufferSize = 4096;
      processor = audioContext.createScriptProcessor(processorBufferSize, sourceNode.channelCount || 1, 1);

      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        try {
          const inputBuffer = ev.inputBuffer;
          const numCh = inputBuffer.numberOfChannels;
          const len = inputBuffer.length;
          const mono = new Float32Array(len);
          
          if (numCh === 1) {
            mono.set(inputBuffer.getChannelData(0));
          } else {
            for (let c = 0; c < numCh; c++) {
              const ch = inputBuffer.getChannelData(c);
              for (let i = 0; i < len; i++) mono[i] += ch[i] / numCh;
            }
          }

          // VAD
          let sum = 0;
          for (let i = 0; i < mono.length; i++) sum += mono[i] * mono[i];
          const rms = Math.sqrt(sum / Math.max(1, mono.length));
          const now = Date.now();
          
          if (rms > silenceThreshold) {
            lastSpeechTimestamp = now;
            committedDueToSilence = false;
            if (onVAD) onVAD(true, rms);
          } else if (lastSpeechTimestamp > 0 && now - lastSpeechTimestamp > silenceTimeoutMs && !committedDueToSilence) {
            committedDueToSilence = true;
            void (async () => {
              try {
                await processBuffer(true);
                sendTranscribe();
              } catch (e) {
                if (onError) onError(e);
              }
            })();
          }

          const int16 = resampleFloat32ToInt16(mono, inputSampleRate, 16000);
          appendToBuffer(new Uint8Array(int16.buffer));
          void processBuffer(false).catch((err) => {
            if (onError) onError(err);
          });
        } catch (err) {
          if (onError) onError(err);
        }
      };

      sourceNode.connect(processor);
      const zeroGain = audioContext.createGain();
      zeroGain.gain.value = 0;
      processor.connect(zeroGain);
      zeroGain.connect(audioContext.destination);
    }
  }

  async function stop() {
    try {
      if (workletNode) {
        try {
          workletNode.port.postMessage({ type: 'reset' });
          workletNode.disconnect();
        } catch { /* ignore */ }
        workletNode = null;
      }
      
      if (processor) {
        try { processor.disconnect(); } catch { /* ignore */ }
        processor.onaudioprocess = null as unknown as ((this: ScriptProcessorNode, ev: AudioProcessingEvent) => void) | null;
        processor = null;
      }
      
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch { /* ignore */ }
        sourceNode = null;
      }

      if (socketOpen) {
        await processBuffer(true);
        sendTranscribe();
      } else if (buffer.length > 0 && onError) {
        onError({ message: 'WebSocket closed before flush', bufferedBytes: buffer.length });
      }

      if (audioContext) {
        try { await audioContext.close(); } catch { /* ignore */ }
        audioContext = null;
      }

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
    } catch { /* ignore */ }
  }

  function closeWs() {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      ws = null;
    } catch { /* ignore */ }
  }

  return {
    start,
    stop,
    closeWs,
    getWebSocket: () => ws,
  };
}

/**
 * Send a single Blob over the ws voice-stt endpoint
 */
type TranscriptMessage = {
  type?: string;
  text?: string;
  is_final?: boolean;
  event?: string;
  [key: string]: unknown;
};

export async function sendBlobOnce(
  blob: Blob,
  opts: { wsUrl?: string; token?: string | null; chunkSize?: number; timeoutMs?: number } = {}
): Promise<TranscriptMessage | string | null> {
  const { wsUrl: rawWsUrl = 'ws://127.0.0.1:8000/api/ws/voice-stt', token = null, chunkSize = 4096, timeoutMs = 30000 } = opts;
  const wsUrl = normalizeWebSocketUrl(rawWsUrl);

  return new Promise<TranscriptMessage | string | null>(async (resolve, reject) => {
    let ws: WebSocket | null = null;
    let lastMsg: TranscriptMessage | string | null = null;
    let settled = false;
    
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws?.close(); } catch { /* ignore */ }
        resolve(lastMsg);
      }
    }, timeoutMs);

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = async () => {
        if (token) {
          try { ws!.send(JSON.stringify({ type: 'authorization', token })); } catch { /* ignore */ }
        }

        let rawAb: ArrayBuffer;
        try {
          const t = blob.type || '';
          const likelyContainer = /webm|opus|ogg|wav|m4a|mp3/i.test(t) || t === '';
          if (likelyContainer) {
            try {
              rawAb = await decodeAudioBlobToPCM16(blob, 16000);
            } catch (e) {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                try { ws?.close(); } catch { /* ignore */ }
                reject({ message: 'Failed to decode audio', error: String(e) });
              }
              return;
            }
          } else {
            rawAb = await blob.arrayBuffer();
          }
        } catch (e) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { ws?.close(); } catch { /* ignore */ }
            reject({ message: 'Failed to get audio buffer', error: String(e) });
          }
          return;
        }

        // Send chunks
        const total = rawAb.byteLength;
        let offset = 0;
        while (offset < total) {
          const end = Math.min(offset + chunkSize, total);
          const slice = rawAb.slice(offset, end);
          const b64 = arrayBufferToBase64(slice);
          ws!.send(JSON.stringify({
            message_type: 'input_audio_chunk',
            audio_base_64: b64,
            commit: false,
            sample_rate: 16000,
          }));

          while (ws!.bufferedAmount > 256 * 1024) {
            await new Promise((r) => setTimeout(r, 50));
          }
          offset = end;
        }
        
        // Send commit
        ws!.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: '',
          commit: true,
          sample_rate: 16000,
        }));
      };

      ws.onmessage = (evt) => {
        if (typeof evt.data === 'string') {
          try {
            const parsed = JSON.parse(evt.data);
            lastMsg = parsed;
            if (
              parsed.type === 'transcript' ||
              parsed.type === 'transcription' ||
              parsed.is_final === true ||
              parsed.event === 'transcript' ||
              parsed.text
            ) {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                try { ws?.close(); } catch { /* ignore */ }
                resolve(parsed);
              }
            }
          } catch {
            lastMsg = evt.data;
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              try { ws?.close(); } catch { /* ignore */ }
              resolve(evt.data);
            }
          }
        }
      };

      ws.onerror = (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try { ws?.close(); } catch { /* ignore */ }
          reject({ message: 'WebSocket error', url: wsUrl });
        }
      };

      ws.onclose = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(lastMsg);
        }
      };
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}
