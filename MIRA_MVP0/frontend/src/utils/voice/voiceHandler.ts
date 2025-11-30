/** @format */
import { stopVoice } from "./voice";
import { getValidToken } from "@/utils/auth";
import { sendBlobOnce } from "./wsVoiceStt";
import { createRealtimeSttClient } from "./realtimeSttClient";

/* ---------------------- Global Mute Control ---------------------- */
export let isMiraMuted = false;

export function setMiraMute(mute: boolean) {
	isMiraMuted = mute;
	console.log(`Mira mute state set to: ${mute}`);
}

/* ---------------------- Conversation Variables ---------------------- */
let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let isConversationActive = false;
let hasUserInteracted = false; // Track if user has interacted with the page
let isAudioPlaying = false; // Prevent recording while AI audio is playing
let currentAudio: HTMLAudioElement | null = null; // Current playing audio for interruption

let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

// WebSocket STT controller instance (started when realtime conversation begins)
let wsController: any = null;

// Simple audio playback with HTML Audio elements
let audioQueue: HTMLAudioElement[] = [];
let isPlayingQueue = false;
let currentPlayingAudio: HTMLAudioElement | null = null;
let isAudioInterrupted = false; // Track if user interrupted AI audio
let lastPartialResponseText = '';
let firstChunkReceivedTime = 0;
let firstAudioPlayTime = 0;

function playNextInQueue() {
	// Block playback if user interrupted
	if (isAudioInterrupted) {
		console.log('🚫 Blocked playNextInQueue - user interrupted');
		isPlayingQueue = false;
		currentPlayingAudio = null;
		isAudioPlaying = false;
		return;
	}
	
	if (audioQueue.length === 0) {
		console.log('✅ Queue empty');
		isPlayingQueue = false;
		currentPlayingAudio = null;
		isAudioPlaying = false;
		return;
	}

	isPlayingQueue = true;
	isAudioPlaying = true;
	const audio = audioQueue.shift()!;
	currentPlayingAudio = audio;

	console.log(`▶️ Playing chunk (${audioQueue.length} remaining)`);

	// Pre-buffer next chunk immediately when this one starts playing
	const preloadNext = () => {
		if (audioQueue.length > 0 && !isAudioInterrupted) {
			const nextAudio = audioQueue[0];
			// Trigger browser to start loading/decoding next chunk
			if (nextAudio.readyState < 2) { // If not already loaded
				nextAudio.load();
				console.log('🔄 Pre-loading next chunk in parallel');
			}
		}
	};

	audio.onended = () => {
		console.log('✅ Chunk complete');
		try {
			URL.revokeObjectURL(audio.src);
		} catch (err) {}
		currentPlayingAudio = null;
		// Don't continue queue if interrupted
		if (!isAudioInterrupted) {
			playNextInQueue();
		} else {
			console.log('🚫 Skipping next chunk - user interrupted');
		}
	};

	audio.onerror = (e) => {
		// Don't log error if we intentionally cleared the source during interruption
		if (!isAudioInterrupted) {
			console.error('❌ Audio error:', e);
		}
		try {
			URL.revokeObjectURL(audio.src);
		} catch (err) {}
		currentPlayingAudio = null;
		// Don't continue queue if interrupted
		if (!isAudioInterrupted) {
			playNextInQueue();
		}
	};

	audio.play()
		.then(() => {
			console.log('✅ Playback started');
			if (firstAudioPlayTime === 0 && firstChunkReceivedTime > 0) {
				firstAudioPlayTime = performance.now();
				const totalLatency = firstAudioPlayTime - firstChunkReceivedTime;
				console.log(`⏱️ 🎯 TOTAL LATENCY: ${totalLatency.toFixed(1)}ms`);
			}
			// Start pre-loading next chunk NOW while this one plays
			preloadNext();
		})
		.catch(err => {
			console.error('❌ Play failed:', err);
			URL.revokeObjectURL(audio.src);
			currentPlayingAudio = null;
			playNextInQueue();
		});
}

function handleAudioChunk(base64: string) {
	try {
		// Ignore chunks if user has interrupted
		if (isAudioInterrupted) {
			console.log('🚫 Ignoring audio chunk - user interrupted');
			return;
		}
		
		if (!base64 || base64.length === 0) {
			console.warn('⚠️ Empty audio chunk');
			return;
		}

		if (firstChunkReceivedTime === 0) {
			firstChunkReceivedTime = performance.now();
			console.log('⏱️ First audio chunk received from backend');
		}

		console.log(`✅ Audio chunk received (${base64.length} bytes)`);

		// Convert base64 to blob - MP3 format
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const blob = new Blob([bytes], { type: 'audio/mpeg' });
		const url = URL.createObjectURL(blob);

		// Create audio element with aggressive preloading
		const audio = new Audio(url);
		audio.preload = 'auto'; // Request browser to preload entire file
		audio.volume = 1.0;
		
		// Immediately trigger load to start decoding in parallel
		// This starts decoding ASAP, not waiting until play() is called
		audio.load();
		
		console.log('🎵 Created Audio element (preloading started)');

		// Add to queue
		audioQueue.push(audio);
		console.log(`📦 Queued (${audioQueue.length} in queue)`);

		// Start playing if not already playing
		if (!isPlayingQueue) {
			playNextInQueue();
		}

	} catch (e) {
		console.error('❌ Failed to handle audio chunk:', e);
	}
}

// Convert AudioBuffer to WAV blob
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
	const numChannels = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	const format = 1; // PCM
	const bitDepth = 16;

	const bytesPerSample = bitDepth / 8;
	const blockAlign = numChannels * bytesPerSample;

	const samples = audioBuffer.getChannelData(0);
	const dataLength = samples.length * numChannels * bytesPerSample;
	const buffer = new ArrayBuffer(44 + dataLength);
	const view = new DataView(buffer);

	// Write WAV header
	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataLength, true);
	writeString(view, 8, 'WAVE');
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // fmt chunk size
	view.setUint16(20, format, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true); // byte rate
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitDepth, true);
	writeString(view, 36, 'data');
	view.setUint32(40, dataLength, true);

	// Write PCM samples
	const offset = 44;
	for (let i = 0; i < samples.length; i++) {
		for (let channel = 0; channel < numChannels; channel++) {
			const channelData = audioBuffer.getChannelData(channel);
			const sample = Math.max(-1, Math.min(1, channelData[i]));
			const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
			view.setInt16(offset + (i * numChannels + channel) * bytesPerSample, intSample, true);
		}
	}

	return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

function handleAudioFinal() {
	console.log('🏁 Audio stream complete');
	// Buffer queue will drain naturally
}

function stopAudioPlayback() {
	console.log('🛑 Stopping audio playback - user interruption');
	
	// Set interrupt flag to ignore incoming chunks from old response
	isAudioInterrupted = true;
	
	// Stop current playing audio IMMEDIATELY with force
	if (currentPlayingAudio) {
		try {
			// INSTANT silence - mute immediately before anything else
			currentPlayingAudio.volume = 0;
			currentPlayingAudio.muted = true;
			currentPlayingAudio.pause();
			currentPlayingAudio.currentTime = 0;
			currentPlayingAudio.src = ''; // Clear source
			currentPlayingAudio.load(); // Force reset
			currentPlayingAudio.remove(); // Remove from DOM if attached
			URL.revokeObjectURL(currentPlayingAudio.src);
			console.log('✅ Forcefully stopped current audio');
		} catch (e) {
			console.debug('Failed to stop current audio:', e);
		}
		currentPlayingAudio = null;
	}
	
	// Clear entire queue - don't play old chunks
	console.log(`🗑️ Clearing ${audioQueue.length} queued audio chunks`);
	audioQueue.forEach(audio => {
		try {
			// Mute first for safety
			audio.volume = 0;
			audio.muted = true;
			audio.pause();
			audio.currentTime = 0;
			audio.src = '';
			audio.load();
			URL.revokeObjectURL(audio.src);
		} catch (e) {}
	});
	audioQueue = [];
	isPlayingQueue = false;
	isAudioPlaying = false;
	
	// Stop HTML5 audio if playing (legacy)
	if (currentAudio) {
		try {
			currentAudio.pause();
			currentAudio.currentTime = 0;
			console.log('✅ Stopped HTML5 audio');
		} catch (e) {
			console.warn('Failed to stop HTML5 audio:', e);
		}
		currentAudio = null;
	}
	
	// Send stop signal to backend if WebSocket is active
	if (wsController && typeof wsController.send === 'function') {
		try {
			wsController.send({ message_type: 'stop_audio' });
			console.log('📤 Sent stop_audio signal to backend');
		} catch (e) {
			console.warn('Failed to send stop_audio signal:', e);
		}
	}
}

function resetAudioState() {
	console.log('🔄 Resetting audio');
	
	// Reset interrupt flag
	isAudioInterrupted = false;
	
	// Stop and clear current audio
	if (currentPlayingAudio) {
		try {
			currentPlayingAudio.pause();
			URL.revokeObjectURL(currentPlayingAudio.src);
		} catch (e) {}
		currentPlayingAudio = null;
	}
	
	// Clear queue
	audioQueue.forEach(audio => {
		try {
			URL.revokeObjectURL(audio.src);
		} catch (e) {}
	});
	
	audioQueue = [];
	isPlayingQueue = false;
	isAudioPlaying = false;
	firstChunkReceivedTime = 0;
	firstAudioPlayTime = 0;
}

async function playAudio(base64: string) {
	try {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const blob = new Blob([bytes], { type: 'audio/mpeg' });
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);
		audio.volume = 1.0;
		audio.onended = () => URL.revokeObjectURL(url);
		audio.onerror = () => URL.revokeObjectURL(url);
		await audio.play();
	} catch (e) {
		console.error('playAudio failed', e);
	}
}

// Centralized server response processor used by both the realtime WS flow and
// the one-shot blob flow. Keeps conversation history, dispatches events,
// and plays TTS audio when provided.
async function processServerResponse(data: any) {
	try {
		if (!data) return;
		
		// Debug: Log ALL incoming messages to diagnose audio issue
		try {
			const logData = typeof data === 'object' ? {
				message_type: data.message_type,
				type: data.type,
				event: data.event,
				hasAudio: !!(data.audio || data.audio_base_64 || data.audio_base64),
				audioFieldName: data.audio ? 'audio' : data.audio_base_64 ? 'audio_base_64' : data.audio_base64 ? 'audio_base64' : 'none',
				audioLength: (data.audio || data.audio_base_64 || data.audio_base64 || '').length,
				text: data.text ? data.text.substring(0, 50) + '...' : null,
				allKeys: Object.keys(data)
			} : data;
			console.log('📥 WS Message received:', logData);
		} catch (e) {
			console.log('📥 WS Message (raw):', data);
		}
		
		// Handle ElevenLabs-specific message types (forwarded by server)
		const msgType = data.message_type || data.type || data.event;
		
		// Handle ElevenLabs session_started confirmation
		if (msgType === 'session_started') {
			console.log('✅ ElevenLabs session started successfully:', {
				session_id: data.session_id,
				sample_rate: data.config?.sample_rate,
			});
			// Session is ready, we can start sending audio
			return; // Don't process as a regular response
		}
		
	// Handle ElevenLabs transcript messages (support a few variants)
	if (msgType === 'partial_transcript' || msgType === 'transcription' || msgType === 'partial_transcription') {
		// Real-time partial transcript - could show in UI as "typing" indicator
		console.debug('📝 Partial transcript:', data.text || data.partial || null);
		// You might want to update UI with partial text here
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('miraPartialResponse', { detail: data.text || data.partial || '' }));
		}
		return;
	}
	
	// Handle partial_response from OpenAI stream
	if (msgType === 'partial_response') {
		if (!firstChunkReceivedTime) {
			console.log('⏱️ First partial_response received - response generation started');
		}
		console.debug('📝 Partial response:', data.text?.substring(0, 50) || '');
		lastPartialResponseText = data.text || '';
		
		// Dispatch event for UI
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('miraPartialResponse', { detail: data.text || '' }));
		}
		return;
	}		if (msgType === 'committed_transcript' || msgType === 'committed_transcript_with_timestamps' || msgType === 'transcription' || msgType === 'final_transcript') {
			// Final committed transcript - this is the complete transcription
			console.log('📝 Final transcript:', data.text);
			// Update data structure to match what processServerResponse expects
			if (data.text && !data.userText) {
				// This is the transcribed user speech
				data.userText = data.text;
			}
			// Continue processing as normal response
		}
		
	// Audio chunk streaming from backend (ElevenLabs TTS chunks)
	// NOTE: Chunks are already accumulated by onAudioChunk callback, 
	// so we just return here to avoid double-accumulation
	if (msgType === 'audio_chunk') {
		console.log('🔉 audio_chunk in processServerResponse (already handled by callback)');
		return;
	}

	if (msgType === 'audio_final') {
		console.log('🏁 audio_final in processServerResponse (already handled by callback)');
		return;
	}		// Log ElevenLabs upstream errors with helpful context
		if (msgType === 'auth_error' || (data.error && (data.error.includes('authenticated') || data.error.includes('ElevenLabs')))) {
			console.error('🔴 ElevenLabs upstream authentication failed. This is a server-side issue:');
			console.error('   1. Check server .env has ELEVENLABS_API_KEY=sk_...');
			console.error('   2. Restart server after .env changes');
			console.error('   3. Verify key is valid for ElevenLabs realtime STT');
			console.error('   4. Check server logs for upstream connection details');
			return; // Don't process error as regular response
		}
		
		if (msgType === 'quota_exceeded_error') {
			console.error('⚠️ ElevenLabs quota exceeded:', data.error);
			return;
		}
		
		if (msgType === 'error') {
			console.error('❌ ElevenLabs error:', data.error);
			return;
		}

		// Handle navigation actions (e.g., morning brief)
		if (data.action === "navigate" && data.actionTarget) {
			console.log("🧭 Navigating to:", data.actionTarget);
			setTimeout(() => {
				if (typeof window !== "undefined") {
					window.location.href = data.actionTarget;
				}
			}, 500);
			return;
		}

		// Calendar modification intents
		if (data.action === "calendar_modify") {
			try {
				const detail = {
					needsDetails: !!data.needsDetails,
					event_query: data.event_query || null,
					action: data.calendar_action || null,
					new_time: data.new_time || null,
				};
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraCalendarModify", { detail })
					);
					console.log("📤 Dispatched miraCalendarModify event:", detail);
				}
			} catch (e) {
				console.warn("Failed to dispatch calendar modify event", e);
			}
		}

		if (data.action === "email_calendar_summary") {
			try {
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraEmailCalendarSummary", {
							detail: data.actionData ?? {},
						})
					);
					console.log("📤 Dispatched miraEmailCalendarSummary event");
				}
			} catch (e) {
				console.warn("Failed to dispatch email/calendar summary event", e);
			}
		}

		// Only process if we have meaningful text
		if (data.text && data.text.trim().length > 0 && !data.error) {
			if (data.userText && data.userText.trim().length > 0) {
				conversationHistory.push({ role: "user", content: data.userText });
			}
			conversationHistory.push({ role: "assistant", content: data.text });
			localStorage.setItem("mira_conversation", JSON.stringify(conversationHistory));

			// Play TTS audio if present (support `audio` or `audio_base_64` field names)
			// NOTE: This is for non-streaming responses only. Streaming audio uses handleAudioChunk.
			const audioField = data.audio || data.audio_base_64 || data.audio_base64 || null;
			if (audioField) {
				console.log("🔊 Audio received (non-streaming), hasUserInteracted:", hasUserInteracted);
				
				// Don't play if queue is already active
				if (isPlayingQueue || currentPlayingAudio) {
					console.warn("⚠️ Skipping non-streaming audio - queue already playing");
					return;
				}

				if (currentAudio) {
					currentAudio.pause();
					currentAudio.currentTime = 0;
					isAudioPlaying = false;
					currentAudio = null;
				}

				if (!hasUserInteracted) {
					console.warn("⚠️ Audio available but user hasn't interacted yet - storing for later");
					localStorage.setItem("pending_audio", data.audio);
					hasUserInteracted = true;
				}

				try {
					const audioBinary = atob(audioField);
					const arrayBuffer = new ArrayBuffer(audioBinary.length);
					const view = new Uint8Array(arrayBuffer);
					for (let i = 0; i < audioBinary.length; i++) {
						view[i] = audioBinary.charCodeAt(i);
					}
					const blob = new Blob([view], { type: "audio/mpeg" });
					const url = URL.createObjectURL(blob);
					const audio = new Audio(url);
					currentAudio = audio;

					audio.volume = 1.0;
					audio.preload = "auto";

					const playAudio = () => {
						isAudioPlaying = true;
						const playPromise = audio.play();
						if (playPromise !== undefined) {
							playPromise
								.then(() => {
									audio.addEventListener("ended", () => {
										isAudioPlaying = false;
										currentAudio = null;
										URL.revokeObjectURL(url);
									});
									audio.addEventListener("error", () => {
										isAudioPlaying = false;
										currentAudio = null;
										URL.revokeObjectURL(url);
									});
								})
								.catch((err) => {
									isAudioPlaying = false;
									currentAudio = null;
									console.error("❌ Audio playback failed:", err);
									URL.revokeObjectURL(url);
								});
						} else {
							isAudioPlaying = false;
							currentAudio = null;
							console.warn("⚠️ audio.play() returned undefined");
						}
					};

					audio.addEventListener("loadeddata", () => playAudio());
					if (audio.readyState >= 2) playAudio();

					// Fallback attempt after a short delay
					setTimeout(() => {
						if (audio.readyState >= 2 && audio.paused) playAudio();
					}, 100);
				} catch (err) {
					console.error("❌ Audio creation/decode failed:", err);
				}
			} else {
				console.log("⚠️ No audio in response");
			}
		} else {
			console.log("No meaningful response, skipping update");
		}
	} catch (err) {
		console.error("processServerResponse error:", err);
	}
}

function logDetailedError(prefix: string, err: any) {
	try {
		if (err instanceof Error) {
			console.error(prefix, { name: err.name, message: err.message, stack: err.stack });
			return;
		}
		if (err && typeof err === 'object') {
			// try stringify first (may fail if circular)
			try {
				console.error(prefix, JSON.parse(JSON.stringify(err)));
			} catch {
				console.error(prefix, err);
			}
			return;
		}
		console.error(prefix, err);
	} catch (e) {
		console.error(prefix, 'failed to log error', e, err);
	}
}

if (typeof window !== "undefined") {
	const stored = localStorage.getItem("mira_conversation");
	if (stored) conversationHistory = JSON.parse(stored);

	// Mark user interaction on any click/touch/keypress
	const markInteraction = () => {
		hasUserInteracted = true;
		document.removeEventListener("click", markInteraction);
		document.removeEventListener("touchstart", markInteraction);
		document.removeEventListener("keydown", markInteraction);
	};

	document.addEventListener("click", markInteraction, { once: true });
	document.addEventListener("touchstart", markInteraction, { once: true });
	document.addEventListener("keydown", markInteraction, { once: true });
}

/* ---------------------- Start Mira Voice ---------------------- */
export async function startMiraVoice() {
	try {
		if (isConversationActive) {
			console.log("Mira already active.");
			return;
		}

		// Mark user interaction when voice is started (mic button click)
		hasUserInteracted = true;

		// Check for pending audio and play it before streaming
		if (typeof window !== "undefined") {
			const pendingAudio = localStorage.getItem("pending_audio");
			if (pendingAudio) {
				try {
					const audioBinary = atob(pendingAudio);
					const arrayBuffer = new ArrayBuffer(audioBinary.length);
					const view = new Uint8Array(arrayBuffer);
					for (let i = 0; i < audioBinary.length; i++) {
						view[i] = audioBinary.charCodeAt(i);
					}
					const blob = new Blob([view], { type: "audio/mpeg" });
					const url = URL.createObjectURL(blob);
					const audio = new Audio(url);
					currentAudio = audio;
					isAudioPlaying = true;
					audio
						.play()
						.then(() => {
							console.log("✅ Playing pending audio");
							localStorage.removeItem("pending_audio");
							audio.addEventListener("ended", () => {
								isAudioPlaying = false;
								currentAudio = null;
								URL.revokeObjectURL(url);
							});
						})
						.catch((err) => {
							isAudioPlaying = false;
							currentAudio = null;
							console.warn("Failed to play pending audio:", err);
							URL.revokeObjectURL(url);
						});
				} catch (err) {
					console.error("Error playing pending audio:", err);
					localStorage.removeItem("pending_audio");
				}
			}
		}

		isConversationActive = true;
		console.log("🎧 Conversation (realtime) started.");

		try {
			// initialize realtime STT client
			const token = await (async () => { try { return await getValidToken(); } catch { return null; } })();
			wsController = createRealtimeSttClient({
				wsUrl: (process.env.NEXT_PUBLIC_WS_URL as string) || 'ws://127.0.0.1:8000/api/ws/voice-stt',
				token,
				chunkSize: 4096,
				onMessage: async (msg: any) => {
					await processServerResponse(msg);
				},
				onPartialResponse: (text: string) => {
					try {
						console.debug('Partial response:', text);
						if (typeof window !== 'undefined') {
							window.dispatchEvent(new CustomEvent('miraPartialResponse', { detail: text }));
						}
					} catch (e) {}
				},
				onAudioChunk: (b64: string) => {
					try { 
						handleAudioChunk(b64);
					} catch (e) { console.error('onAudioChunk handler failed', e); }
				},
				onAudioFinal: () => {
					try { 
						handleAudioFinal();
					} catch (e) { console.error('onAudioFinal failed', e); }
				},
				onResponse: (text: string, audioB64?: string | null) => {
					try {
						console.log('Realtime response received:', text);
						
						if (audioB64) {
							// non-streaming audio, play as a single chunk
							void playAudio(audioB64);
						}
						// also forward to the usual processor so conversation state updates
						void processServerResponse({ text, audio: audioB64 });
					} catch (e) { console.error('onResponse handler failed', e); }
				},
				onError: (e: any) => {
					try { logDetailedError('WS stt error:', e); } catch (logErr) { console.error('WS stt error (logging failed)', logErr, e); }
				},
				onClose: (ev?: CloseEvent) => {
					console.log('WS stt closed', ev ? {
						code: ev.code,
						reason: ev.reason,
						wasClean: ev.wasClean,
					} : '');
				},
				onOpen: () => console.log('WS stt open'),
				onStateChange: (state: any) => {
					console.log('🔄 WebSocket state changed:', state);
					// Dispatch event for UI components
					if (typeof window !== 'undefined') {
						window.dispatchEvent(new CustomEvent('wsStateChange', { detail: state }));
					}
				},
			});

			// Make wsController globally accessible for manual reconnection
			if (typeof window !== 'undefined') {
				(window as any).wsController = wsController;
			}

			await wsController.start();

			// Keep loop alive while conversation active; monitor interruption
			while (isConversationActive) {
				// Monitor for interruption when audio is playing
				if (isPlayingQueue || currentPlayingAudio) {
					const interrupted = await monitorForInterruption();
					if (interrupted) {
						console.log('🛑 Audio interrupted by user');
						// stopAudioPlayback() already called in monitorForInterruption
					}
				}
				await new Promise((res) => setTimeout(res, 100)); // Check more frequently
			}

			console.log('🪞 Realtime conversation ended.');
		} catch (err) {
			logDetailedError('Conversation (realtime) error:', err);
			isConversationActive = false;
		}
	} catch (err) {
		logDetailedError("Conversation error:", err);
		isConversationActive = false;
	}
}

/* ---------------------- Stop Mira Voice ---------------------- */
export function stopMiraVoice() {
	isConversationActive = false;
	isAudioPlaying = false; // Stop waiting for audio playback
	
	// Use the new reset function to clean up HTML Audio elements
	resetAudioState();
	
	if (currentAudio) {
		currentAudio.pause();
		currentAudio = null;
	}

	if (activeRecorder && activeRecorder.state === "recording") {
		activeRecorder.stop();
	}

	if (activeStream) {
		activeStream.getTracks().forEach((track) => track.stop());
		activeStream = null;
	}

	stopVoice();
	console.log("🛑 Conversation manually stopped.");
}

/* ---------------------- Audio Energy Detection ---------------------- */
function analyzeAudioEnergy(stream: MediaStream): {
	stop: () => { maxEnergy: number; avgEnergy: number; speechFrames: number };
} {
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let source: MediaStreamAudioSourceNode | null = null;
	let maxEnergy = 0;
	let totalEnergy = 0;
	let frameCount = 0;
	let speechFrames = 0;
	let analyzeInterval: NodeJS.Timeout | null = null;

	try {
		audioContext = new AudioContext();
		source = audioContext.createMediaStreamSource(stream);
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 2048;
		source.connect(analyser);

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Float32Array(bufferLength);

		analyzeInterval = setInterval(() => {
			if (!analyser) return;

			analyser.getFloatTimeDomainData(dataArray);

			// Calculate RMS (Root Mean Square) energy
			let sum = 0;
			for (let i = 0; i < bufferLength; i++) {
				sum += dataArray[i] * dataArray[i];
			}
			const rms = Math.sqrt(sum / bufferLength);
			const energy = rms * 100; // Scale to 0-100

			maxEnergy = Math.max(maxEnergy, energy);
			totalEnergy += energy;
			frameCount++;

			if (energy > 5) {
				// Count frames with significant energy
				speechFrames++;
			}
		}, 100); // Sample every 100ms
	} catch (err) {
		console.error("Audio energy analysis failed:", err);
	}

	return {
		stop: () => {
			if (analyzeInterval) clearInterval(analyzeInterval);
			if (audioContext) {
				try {
					audioContext.close();
				} catch {
					// Ignore close errors
				}
			}
			const avgEnergy = frameCount > 0 ? totalEnergy / frameCount : 0;
			return { maxEnergy, avgEnergy, speechFrames };
		},
	};
}

/* ---------------------- Interruption Detection ---------------------- */
async function monitorForInterruption(): Promise<boolean> {
	return new Promise((resolve) => {
		// Only monitor if audio is actually playing
		if (!isPlayingQueue && !currentPlayingAudio) {
			resolve(false);
			return;
		}

		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				const audioContext = new AudioContext();
				const source = audioContext.createMediaStreamSource(stream);
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 2048;
				source.connect(analyser);

				const bufferLength = analyser.frequencyBinCount;
				const dataArray = new Float32Array(bufferLength);

				let checkCount = 0;
				let highEnergyCount = 0;
				const maxChecks = 100; // Check for up to 5 seconds (100 * 50ms)

				const checkInterval = setInterval(() => {
					// Stop monitoring if no audio is playing
					if (!isPlayingQueue && !currentPlayingAudio) {
						clearInterval(checkInterval);
						audioContext.close();
						stream.getTracks().forEach((track) => track.stop());
						resolve(false);
						return;
					}

					analyser.getFloatTimeDomainData(dataArray);
					let sum = 0;
					for (let i = 0; i < bufferLength; i++) {
						sum += dataArray[i] * dataArray[i];
					}
					const rms = Math.sqrt(sum / bufferLength);
					const energy = rms * 100;

					if (energy > 8) {
						// Lower threshold for faster interruption detection
						highEnergyCount++;
						if (highEnergyCount >= 1) {
							// Require only 1 frame for immediate response
							console.log(
								"🎤 User interruption detected, energy:",
								energy.toFixed(2),
								"frames:",
								highEnergyCount
							);
							
							// Stop all audio playback and notify backend
							stopAudioPlayback();
							
							// Clean up monitoring
							clearInterval(checkInterval);
							audioContext.close();
							stream.getTracks().forEach((track) => track.stop());
							
							resolve(true);
							return;
						}
					} else {
						highEnergyCount = 0; // Reset if energy drops
					}

					checkCount++;
					if (checkCount >= maxChecks) {
						clearInterval(checkInterval);
						audioContext.close();
						stream.getTracks().forEach((track) => track.stop());
						resolve(false);
					}
				}, 50); // Check every 50ms for faster response
			})
			.catch((err) => {
				console.error("Failed to monitor for interruption:", err);
				resolve(false);
			});
	});
}

/**
 * Upload a Blob/File to the backend in fixed-size chunks (default 4096 bytes).
 * Each chunk is sent as multipart/form-data with field `audio`.
 * By default metadata/history are attached to the first chunk (set sendMetaOnFirstChunk=false to send every chunk).
 */


/* ---------------------- Record → Send → Play Cycle ---------------------- */
async function recordOnce(): Promise<void> {
	return new Promise<void>(async (resolve, reject) => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			activeStream = stream;

			// Start analyzing audio energy while recording
			const energyAnalyzer = analyzeAudioEnergy(stream);

			activeRecorder = new MediaRecorder(stream, {
				mimeType: "audio/webm;codecs=opus",
			});

			const chunks: BlobPart[] = [];

			activeRecorder.ondataavailable = (event: BlobEvent) => {
				if (event.data && event.data.size > 0) chunks.push(event.data);
			};

		activeRecorder.onstop = async () => {
			// User is speaking - reset interrupt flag for new AI response
			isAudioInterrupted = false;
			console.log('🎭 Reset audio interrupt flag - ready for new response');
			
			// Stop energy analysis and get stats
				const { maxEnergy, avgEnergy, speechFrames } = energyAnalyzer.stop();
				const audioBlob = new Blob(chunks, { type: "audio/webm" });

				console.log(
					"🎙️ Segment recorded - size:",
					audioBlob.size,
					"bytes, max energy:",
					maxEnergy.toFixed(2),
					"avg energy:",
					avgEnergy.toFixed(2),
					"speech frames:",
					speechFrames
				);

				// 💡 Skip short/silent audio (<20 KB) - increased threshold
				if (audioBlob.size < 20000) {
					console.warn(
						"⚠️ Audio too short or silent — skipping Whisper request.",
						audioBlob.size,
						"bytes"
					);
					chunks.length = 0;
					resolve();
					return;
				}

				// 💡 Skip low-energy audio (likely silence/noise)
				// Require at least some frames with speech energy and decent average
				if (speechFrames < 1) {
					console.warn("Low energy — but sending anyway.");
				}

				const formData = new FormData();
				formData.append("audio", audioBlob, "user_input.webm");

				try {
					// Use WebSocket STT/TTS path instead of HTTP endpoint
					let data: any = null;
					try {
						const token = await (async () => {
							try { return await getValidToken(); } catch { return null; }
						})();

						// Send recorded blob via websocket helper and await transcript-like response
						const wsResult = await sendBlobOnce(audioBlob, {
							wsUrl: (process.env.NEXT_PUBLIC_WS_URL as string) || 'ws://127.0.0.1:8000/api/ws/voice-stt',
							token,
							chunkSize: 4096,
							timeoutMs: 30000,
						});
						data = wsResult ?? {};
						console.log("🪞 WS server response:", data);
					} catch (e) {
						console.error('Voice pipeline WS error', e);
						resolve();
						return;
					}

					try {
						await processServerResponse(data);
					} catch (err) {
						console.error('Voice pipeline error:', err);
					}
				} catch (err) {
					console.error("Voice pipeline error:", err);
				}

					chunks.length = 0; // clear memory
					resolve();
			};

			// Start recording
			activeRecorder!.start();
			console.log("🎧 Listening...");

			// ⏱️ Auto-stop after 5 seconds
			setTimeout(() => {
				if (activeRecorder && activeRecorder.state === "recording") {
					activeRecorder.stop();
					stream.getTracks().forEach((track) => track.stop());
				}
			}, 5000);
		} catch (err) {
			console.error("Recording error:", err);
			reject(err);
		}
	});
}
