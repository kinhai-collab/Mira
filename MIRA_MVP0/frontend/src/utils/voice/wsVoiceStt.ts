/*
WebSocket STT streamer
- Connects to ws://127.0.0.1:8000/ws/voice-stt by default (or use options.wsUrl)
- Collects audio from MediaRecorder, encodes into raw bytes, buffers and slices 4096-byte chunks
- Sends JSON text messages: {"type":"input_audio_buffer.append","audio":"<base64>"}
- When finished sends: {"type":"input_audio_buffer.commit"}
- Then requests transcription: {"type":"transcribe","response_format":"verbose"}
- Calls onTranscript callback for text frames sent by server

Notes:
- This is browser-side TypeScript; import/adjust as needed in your app.
- Provide `token` in options; it will be sent as an initial auth message. If your server expects token in querystring, provide it in wsUrl.
- WebSocket URLs are automatically normalized to use wss:// when the page is loaded over HTTPS.
*/

import { normalizeWebSocketUrl, getWebSocketUrl } from './websocketUrl';

type Options = {
  wsUrl?: string;
  token?: string | null;
  chunkSize?: number; // bytes per chunk before base64-encoding and send
  mediaRecorderTimeslice?: number; // ms for MediaRecorder.start(timeslice)
  mimeType?: string; // e.g. 'audio/webm;codecs=opus'
  onTranscript?: (msg: unknown) => void; // called when server sends transcript frames
  onOpen?: () => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (err: unknown) => void;
  onProgress?: (sentBytes: number, totalBuffered: number) => void;
};

export function arrayBufferToBase64(ab: ArrayBuffer): string {
  // convert in chunks to avoid call stack / memory issues
  const chunkSize = 0x8000; // 32KB per chunk
  const uint8 = new Uint8Array(ab);
  let i = 0;
  const len = uint8.length;
  let result = '';
  while (i < len) {
    const slice = uint8.subarray(i, Math.min(i + chunkSize, len));
    result += String.fromCharCode.apply(null, Array.from(slice));
    i += chunkSize;
  }
  return btoa(result);
}

// Decode an encoded audio Blob (webm/opus/ogg/wav/...) to PCM16@targetRate
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
          // Fallback for older browsers with callback-based API
          (ac as unknown as { decodeAudioData: (buffer: ArrayBuffer, successCallback: (decodedData: AudioBuffer) => void, errorCallback: (error: DOMException) => void) => void }).decodeAudioData(ab.slice(0), resolve, reject);
        }
      } catch (err) {
        reject(err);
      }
    });

    const numChannels = decoded.numberOfChannels;
    let sourceBuffer: AudioBuffer = decoded;

    // If sampleRate differs, use OfflineAudioContext to resample and mixdown to mono
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
      // mix to mono
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

    try { ac.close(); } catch {}
    return pcm16.buffer;
  } catch (err) {
    try { ac.close(); } catch {}
    throw err;
  }
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
  } = options;

  const defaultWs = getWebSocketUrl('ws://127.0.0.1:8000/api/ws/voice-stt');
  const connectUrl = normalizeWebSocketUrl((options.wsUrl && options.wsUrl.length > 0) ? options.wsUrl : defaultWs);

  let ws: WebSocket | null = null;
  let stream: MediaStream | null = null;

  // internal buffer of bytes to slice into chunkSize blocks
  let buffer = new Uint8Array(0);
  let sentBytes = 0;
  let socketOpen = false;
  let debugLoggedFirstChunk = false;
  // audio capture via WebAudio (preferred) — falls back to MediaRecorder decode path
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let zeroGain: GainNode | null = null;

  // Convert a Blob (webm/opus/etc.) into PCM16@targetRate (Uint8Array little-endian)
  // Note: This function is defined but currently unused - kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function convertBlobToPCM16(blob: Blob, targetRate = 16000): Promise<ArrayBuffer> {
    if (!blob || blob.size === 0) throw new Error('convertBlobToPCM16: empty blob');
    const ab = await blob.arrayBuffer();
    // Use AudioContext to decode
    const AudioCtx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
    const ac = new AudioCtx();
    try {
      // Some browsers' decodeAudioData implementations are callback-based; wrap for compatibility
      const decoded: AudioBuffer = await new Promise((resolve, reject) => {
        try {
          const p = ac.decodeAudioData(ab.slice(0));
          if (p && typeof (p as Promise<AudioBuffer>).then === 'function') {
            (p as Promise<AudioBuffer>).then(resolve).catch((err) => reject(err));
          } else {
            // fallback to callback style
            (ac as unknown as { decodeAudioData: (buffer: ArrayBuffer, successCallback: (decodedData: AudioBuffer) => void, errorCallback: (error: DOMException) => void) => void }).decodeAudioData(ab.slice(0), resolve, reject);
          }
        } catch (err) {
          reject(err);
        }
      });

      // If already the target sample rate and mono, convert directly
      const numChannels = decoded.numberOfChannels;
      let sourceBuffer: AudioBuffer = decoded;

      // If sampleRate differs, use OfflineAudioContext to resample
      if (decoded.sampleRate !== targetRate) {
        const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
        const src = offline.createBufferSource();
        // Mix down to mono by copying channel 0 and merging
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
        // mix to mono
        const tmp = ac.createBuffer(1, decoded.length, decoded.sampleRate);
        const out = tmp.getChannelData(0);
        for (let c = 0; c < numChannels; c++) {
          const ch = decoded.getChannelData(c);
          for (let i = 0; i < ch.length; i++) out[i] = (out[i] || 0) + ch[i] / numChannels;
        }
        sourceBuffer = tmp;
      }

      // Convert Float32 samples [-1,1] to Int16 little-endian
      const float32 = sourceBuffer.getChannelData(0);
      const pcm16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Close the audio context to free resources
      try { ac.close(); } catch {}

      return pcm16.buffer;
    } catch (err) {
      try { ac.close(); } catch {}
      throw err;
    }
  }

  function appendToBuffer(newBuf: Uint8Array) {
    const tmp = new Uint8Array(buffer.length + newBuf.length);
    tmp.set(buffer, 0);
    tmp.set(newBuf, buffer.length);
    buffer = tmp;
  }

  // Resample float32 input to targetRate and convert to Int16Array
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

  async function processBuffer(flush = false) {
    // If the WebSocket isn't open, don't attempt sends now — leave buffer intact.
    if (!socketOpen) return;

    // while we have at least chunkSize bytes, send them
    while (buffer.length >= chunkSize) {
      const chunk = buffer.subarray(0, chunkSize);
      buffer = buffer.subarray(chunkSize);
      await sendAppendChunk(chunk.buffer, false);
    }
    // if flushing, send any remaining bytes with commit: false, then send empty commit
    if (flush) {
      if (buffer.length > 0) {
        const final = buffer;
        buffer = new Uint8Array(0);
        await sendAppendChunk(final.buffer, false);
      }
      // Send final empty commit message
      await sendAppendChunk(new ArrayBuffer(0), true);
    }
    if (onProgress) onProgress(sentBytes, buffer.length);
  }

  async function sendAppendChunk(ab: ArrayBuffer, commit: boolean) {
    // If socket isn't open, bail out gracefully (leave buffer intact).
    if (!ws || ws.readyState !== WebSocket.OPEN || !socketOpen) {
      // notify caller/application once
      if (onError) onError({ message: 'WebSocket is not open (sendAppendChunk skipped)' });
      return;
    }

    // base64-encode PCM16 ArrayBuffer payload (empty string for commit)
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
      // surface error but don't throw so audio thread won't crash
      if (onError) onError(e);
      return;
    }

    // simple backpressure: if bufferedAmount high, wait until it drains
    while (ws.bufferedAmount > 256 * 1024) {
      // wait a short time
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Note: sendCommit is defined but currently unused - kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function sendCommit() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      // Send final commit chunk with empty audio_base_64
      ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: '',
        commit: true,
        sample_rate: 16000,
      }));
    } catch (e) {
      console.error('Failed to send commit', e);
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
    // server will forward transcript messages as text frames
    if (typeof evt.data === 'string') {
      try {
        const parsed = JSON.parse(evt.data);
        if (onTranscript) onTranscript(parsed);
      } catch {
        // if it's plain text, forward raw
        if (onTranscript) onTranscript(evt.data);
      }
      } else {
        // binary server messages: ignore or handle if needed
        // some server might send binary audio back for TTS — we ignore here
      }
  }

  async function initWebSocket() {
    return new Promise<void>((resolve, reject) => {
      try {
        // If a token is provided and not already present in the URL, append it as a query param.
        let urlToUse = connectUrl;
        try {
          if (token && !/([?&])token=/.test(connectUrl)) {
            const sep = connectUrl.includes('?') ? '&' : '?';
            urlToUse = `${connectUrl}${sep}token=${encodeURIComponent(token)}`;
          }
        } catch {
          urlToUse = connectUrl;
        }

        ws = new WebSocket(urlToUse);
        ws.binaryType = 'arraybuffer';

        // If the socket doesn't open within this timeout, reject so caller can react
        const openTimeoutMs = 5000;
        let didOpen = false;
        const openTimer = setTimeout(() => {
          if (!didOpen) {
            const info = {
              message: 'WebSocket open timeout',
              url: connectUrl,
              readyState: ws?.readyState,
            };
            try { ws?.close(); } catch {}
            if (onError) onError(info);
            reject(info);
          }
        }, openTimeoutMs);

        ws.onopen = () => {
          didOpen = true;
          clearTimeout(openTimer);
          socketOpen = true;
          // send auth as initial message if token present
          // Some servers expect token in querystring; if we didn't append it, also send authorization message.
          if (token) {
            try {
              const authMsg = { type: 'authorization', token };
              ws?.send(JSON.stringify(authMsg));
            } catch (e) {
              // Failed to send auth message
            }
          }
          ws!.onmessage = handleServerMessage;
          ws!.onclose = (ev) => {
            // update socket state
            socketOpen = false;
            // forward close event with structured info
            const closeInfo = {
              message: 'WebSocket closed',
              code: ev?.code ?? null,
              reason: ev?.reason ?? null,
              wasClean: ev?.wasClean ?? null,
              url: connectUrl,
            };
            if (onClose) onClose(ev);
            if (onError) onError(closeInfo);
          // stop audio capture to avoid flood of 'not open' errors
          try { void stop(); } catch { /* swallow */ }
          };
          ws!.onmessage = handleServerMessage;
          if (onOpen) onOpen();
          resolve();
        };

        ws.onerror = (err) => {
          // Provide a richer error object to callers — the browser Event is often opaque
          const info = {
            message: 'WebSocket error',
            url: connectUrl,
            readyState: ws?.readyState,
            // include event type when available
            eventType: (err && (err as Event).type) || null,
            raw: String(err),
          };
          socketOpen = false;
          if (onError) onError(info);
          // If we haven't opened yet, reject so initWebSocket callers don't hang
          if (!didOpen) {
            clearTimeout(openTimer);
            try { ws?.close(); } catch {}
            reject(info);
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

    await initWebSocket();

    // start capturing audio via Web Audio API (preferred).
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const AudioCtx = (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
    audioContext = new AudioCtx();
    sourceNode = (audioContext as AudioContext).createMediaStreamSource(stream);

    // ScriptProcessor buffer size: use 4096 for reasonable latency and chunk alignment
    const processorBufferSize = 4096;
    processor = (audioContext as AudioContext).createScriptProcessor(processorBufferSize, sourceNode.channelCount || 1, 1);
    zeroGain = (audioContext as AudioContext).createGain();
    zeroGain.gain.value = 0;

    const inputSampleRate = (audioContext as AudioContext).sampleRate || 48000;

    processor.onaudioprocess = (ev: AudioProcessingEvent) => {
      try {
        const inputBuffer = ev.inputBuffer;
        const numCh = inputBuffer.numberOfChannels;
        const len = inputBuffer.length;
        // mix to mono
        const mono = new Float32Array(len);
        if (numCh === 1) {
          mono.set(inputBuffer.getChannelData(0));
        } else {
          for (let c = 0; c < numCh; c++) {
            const ch = inputBuffer.getChannelData(c);
            for (let i = 0; i < len; i++) mono[i] += ch[i] / numCh;
          }
        }

        // resample + convert to Int16
        const int16 = resampleFloat32ToInt16(mono, inputSampleRate, 16000);

        // append bytes (raw little-endian PCM16)
        appendToBuffer(new Uint8Array(int16.buffer));

        // schedule async buffer processing; don't await in the audio thread
        void processBuffer(false).catch((err) => {
          console.error('processBuffer error', err);
          if (onError) onError(err);
        });
      } catch (err) {
        console.error('Audio processing error', err);
        if (onError) onError(err);
      }
    };

    sourceNode.connect(processor);
    processor.connect(zeroGain);
    zeroGain.connect((audioContext as AudioContext).destination);

    return;
  }

  async function stop() {
    try {
      // disconnect and stop WebAudio nodes if present
      if (processor) {
        try { processor.disconnect(); } catch {}
        processor.onaudioprocess = null as unknown as ((this: ScriptProcessorNode, ev: AudioProcessingEvent) => void) | null;
        processor = null;
      }
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch {}
        sourceNode = null;
      }
      if (zeroGain) {
        try { zeroGain.disconnect(); } catch {}
        zeroGain = null;
      }

      // flush any remaining buffered audio, commit and request transcription
      try {
        // only attempt to flush if socket is still open; otherwise skip
        if (socketOpen) {
          await processBuffer(true); // This now sends remaining bytes + empty commit
          sendTranscribe();
        } else {
          // socket closed — report that remaining audio couldn't be sent
          if (buffer && buffer.length > 0 && onError) {
            onError({ message: 'WebSocket closed before flush; audio remains buffered', bufferedBytes: buffer.length });
          }
        }
      } catch (e) {
        console.error('Error flushing buffer on stop', e);
        if (onError) onError(e);
      }

      if (audioContext) {
        try { await audioContext.close(); } catch {}
        audioContext = null;
      }

      // stop tracks
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      } catch (e) {
        // Failed to stop audio capture
      }
    // keep the ws open to receive transcripts; caller may call closeWs to close
  }

  function closeWs() {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      ws = null;
    } catch (e) {
      // Error closing ws
    }
  }

  // return controller to the caller
  return {
    start,
    stop,
    closeWs,
    // expose websocket for debug (may be null initially)
    getWebSocket: () => ws,
  };
}

/**
 * Send a single Blob/File over the ws voice-stt endpoint by chunking into base64 append messages,
 * then sending commit + transcribe and returning the first or last transcript-like server message.
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
    let sendBlobOnceLoggedFirstChunk = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws?.close(); } catch {}
        resolve(lastMsg);
      }
    }, timeoutMs);

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = async () => {
        if (token) {
          try { ws!.send(JSON.stringify({ type: 'authorization', token })); } catch {}
        }

        // The server expects raw PCM16@16000 bytes in base64 inside JSON frames.
        // Try to convert encoded containers (webm/opus/ogg/wav/...) to PCM16@16k.
        let rawAb: ArrayBuffer;
        try {
          const t = blob.type || '';
          const likelyContainer = /webm|opus|ogg|wav|m4a|mp3/i.test(t) || t === '';
          if (likelyContainer) {
            try {
              rawAb = await decodeAudioBlobToPCM16(blob, 16000);
            } catch (e) {
              // Do NOT send container formats raw — upstream won't transcode.
              const info = { message: 'Failed to decode audio blob to PCM16. Not sending container formats.', error: String(e) };
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                try { ws?.close(); } catch {}
                reject(info);
              }
              return;
            }
          } else {
            // If blob is already raw PCM bytes, just take its ArrayBuffer
            rawAb = await blob.arrayBuffer();
          }
        } catch (e) {
          const info = { message: 'Failed to obtain audio ArrayBuffer', error: String(e) };
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { ws?.close(); } catch {}
            reject(info);
          }
          return;
        }

        // slice rawAb into chunkSize bytes and send as ElevenLabs-style frames
        const total = rawAb.byteLength;
        let offset = 0;
        while (offset < total) {
          const end = Math.min(offset + chunkSize, total);
          const slice = rawAb.slice(offset, end);
          const b64 = arrayBufferToBase64(slice);
          const msg = {
            message_type: 'input_audio_chunk',
            audio_base_64: b64,
            commit: false,
            sample_rate: 16000,
          };
          ws!.send(JSON.stringify(msg));

          // backpressure
          while (ws!.bufferedAmount > 256 * 1024) {
            await new Promise((r) => setTimeout(r, 50));
          }

          offset = end;
        }
        // Send final empty commit message
        const commitMsg = {
          message_type: 'input_audio_chunk',
          audio_base_64: '',
          commit: true,
          sample_rate: 16000,
        };
        ws!.send(JSON.stringify(commitMsg));
      };

      ws.onmessage = (evt) => {
        if (typeof evt.data === 'string') {
          try {
            const parsed = JSON.parse(evt.data);
            lastMsg = parsed;
            // heuristics: if parsed looks like a final transcription, resolve
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
                try { ws?.close(); } catch {}
                resolve(parsed);
              }
            }
          } catch {
            // not JSON — treat as raw text
            lastMsg = evt.data;
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              try { ws?.close(); } catch {}
              resolve(evt.data);
            }
          }
        } else {
          // binary from server — ignore or collect
        }
      };

      ws.onerror = (err) => {
        // Wrap Event into a structured object so caller logs are useful
        const info = {
          message: 'WebSocket error (sendBlobOnce)',
          url: wsUrl,
          eventType: (err && (err as Event).type) || null,
          raw: String(err),
        };
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try { ws?.close(); } catch {}
          reject(info);
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
