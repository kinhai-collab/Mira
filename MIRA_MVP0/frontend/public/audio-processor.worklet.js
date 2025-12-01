/**
 * AudioWorklet Processor for real-time audio capture
 * Runs on a separate thread for low-latency, glitch-free audio processing
 * 
 * This replaces the deprecated ScriptProcessorNode
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // Target sample rate for output (16kHz for STT)
    this.targetSampleRate = options.processorOptions?.targetSampleRate || 16000;
    this.inputSampleRate = sampleRate; // AudioWorklet global
    
    // Buffer to accumulate samples before sending
    this.buffer = new Float32Array(0);
    this.bufferSize = 4096; // Send in chunks
    
    // VAD state
    this.silenceThreshold = options.processorOptions?.silenceThreshold || 0.008;
    this.lastSpeechTime = 0;
    this.silenceTimeoutMs = options.processorOptions?.silenceTimeoutMs || 1200;
    this.committedDueToSilence = false;
    
    // Resampling state for high-quality resampling
    this.resampleRatio = this.inputSampleRate / this.targetSampleRate;
    this.resampleBuffer = [];
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'reset') {
        this.buffer = new Float32Array(0);
        this.resampleBuffer = [];
        this.committedDueToSilence = false;
        this.lastSpeechTime = 0;
      } else if (event.data.type === 'setThreshold') {
        this.silenceThreshold = event.data.threshold;
      }
    };
  }

  /**
   * High-quality resampling using linear interpolation
   */
  resample(input) {
    if (this.inputSampleRate === this.targetSampleRate) {
      return input;
    }
    
    const outputLength = Math.round(input.length / this.resampleRatio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * this.resampleRatio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      // Linear interpolation
      output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
    }
    
    return output;
  }

  /**
   * Convert Float32 samples to Int16 PCM
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return int16Array;
  }

  /**
   * Calculate RMS energy for VAD
   */
  calculateRMS(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Mix multiple channels to mono
   */
  mixToMono(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return null;
    
    const numChannels = input.length;
    const frameSize = input[0].length;
    const mono = new Float32Array(frameSize);
    
    if (numChannels === 1) {
      mono.set(input[0]);
    } else {
      for (let c = 0; c < numChannels; c++) {
        const channel = input[c];
        for (let i = 0; i < frameSize; i++) {
          mono[i] += channel[i] / numChannels;
        }
      }
    }
    
    return mono;
  }

  process(inputs, outputs, parameters) {
    const mono = this.mixToMono(inputs);
    if (!mono) return true;
    
    // Calculate RMS for VAD
    const rms = this.calculateRMS(mono);
    const now = currentTime * 1000; // Convert to ms
    
    // VAD logic
    if (rms > this.silenceThreshold) {
      this.lastSpeechTime = now;
      this.committedDueToSilence = false;
      
      // Send speech detected event
      this.port.postMessage({
        type: 'vad',
        speaking: true,
        rms: rms
      });
    } else {
      // Check for silence timeout
      if (this.lastSpeechTime > 0 && 
          now - this.lastSpeechTime > this.silenceTimeoutMs && 
          !this.committedDueToSilence) {
        this.committedDueToSilence = true;
        
        // Send silence commit signal
        this.port.postMessage({
          type: 'silenceCommit',
          rms: rms
        });
      }
    }
    
    // Resample to target sample rate
    const resampled = this.resample(mono);
    
    // Append to buffer
    const newBuffer = new Float32Array(this.buffer.length + resampled.length);
    newBuffer.set(this.buffer, 0);
    newBuffer.set(resampled, this.buffer.length);
    this.buffer = newBuffer;
    
    // Send chunks when buffer is full
    while (this.buffer.length >= this.bufferSize) {
      const chunk = this.buffer.slice(0, this.bufferSize);
      this.buffer = this.buffer.slice(this.bufferSize);
      
      // Convert to Int16 PCM
      const pcm16 = this.float32ToInt16(chunk);
      
      // Send audio data to main thread
      this.port.postMessage({
        type: 'audio',
        pcm16: pcm16.buffer,
        rms: rms
      }, [pcm16.buffer]); // Transfer ownership for efficiency
    }
    
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);

