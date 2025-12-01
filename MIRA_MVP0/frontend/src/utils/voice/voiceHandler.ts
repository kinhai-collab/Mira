/** @format */
import { stopVoice } from "./voice";
import { getValidToken } from "@/utils/auth";
import { sendBlobOnce } from "./wsVoiceStt";
import { createRealtimeSttClient } from "./realtimeSttClient";
import { ConnectionState } from "./WebSocketManager";
import { getWebSocketUrl } from "./websocketUrl";

/* ---------------------- Global Mute Control ---------------------- */
export let isMiraMuted = false;

export function setMiraMute(mute: boolean) {
	isMiraMuted = mute;

	if (mute) {
		// Stop all audio playback immediately
		stopAllAudio();
		stopVoice();
	}
}

/* ---------------------- Unified Audio Manager ---------------------- */
class AudioManager {
	private queue: HTMLAudioElement[] = [];
	private currentAudio: HTMLAudioElement | null = null;
	private isPlaying = false;
	private interrupted = false;

	constructor() {
		// Bind methods to preserve context
		this.playNext = this.playNext.bind(this);
	}

	enqueue(base64: string, mimeType = 'audio/mpeg') {
		if (isMiraMuted || this.interrupted) return;
		
		try {
			const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
			const blob = new Blob([bytes], { type: mimeType });
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);
			audio.preload = 'auto';
			audio.volume = 1.0;
			
			// Pre-load immediately
			audio.load();
			
			this.queue.push(audio);
			
			if (!this.isPlaying) {
				this.playNext();
			}
		} catch (e) {
			console.error('[AudioManager] Failed to enqueue audio:', e);
		}
	}

	private playNext() {
		if (isMiraMuted || this.interrupted || this.queue.length === 0) {
			this.isPlaying = false;
			this.currentAudio = null;
			return;
		}

		this.isPlaying = true;
		const audio = this.queue.shift()!;
		this.currentAudio = audio;

		const cleanup = () => {
			try {
				URL.revokeObjectURL(audio.src);
			} catch { /* ignore */ }
			this.currentAudio = null;
			if (!this.interrupted) {
				this.playNext();
			}
		};

		audio.onended = cleanup;
		audio.onerror = () => {
			console.error('[AudioManager] Audio playback error');
			cleanup();
		};

		audio.play().catch((err) => {
			console.error('[AudioManager] Play failed:', err);
			cleanup();
		});
	}

	stop() {
		this.interrupted = true;
		
		// Stop current audio immediately
		if (this.currentAudio) {
			try {
				this.currentAudio.volume = 0;
				this.currentAudio.muted = true;
				this.currentAudio.pause();
				this.currentAudio.src = '';
				URL.revokeObjectURL(this.currentAudio.src);
			} catch { /* ignore */ }
			this.currentAudio = null;
		}

		// Clear queue
		for (const audio of this.queue) {
			try {
				audio.pause();
				audio.src = '';
				URL.revokeObjectURL(audio.src);
			} catch { /* ignore */ }
		}
		this.queue = [];
		this.isPlaying = false;
	}

	reset() {
		this.stop();
		this.interrupted = false;
	}

	isActive() {
		return this.isPlaying || this.queue.length > 0;
	}
}

const audioManager = new AudioManager();

function stopAllAudio() {
	audioManager.stop();
	
	// Legacy cleanup
	if (currentAudio) {
		try {
			currentAudio.pause();
			currentAudio.currentTime = 0;
		} catch { /* ignore */ }
		currentAudio = null;
	}
	
	if (currentPlayingAudio) {
		try {
			currentPlayingAudio.pause();
			URL.revokeObjectURL(currentPlayingAudio.src);
		} catch { /* ignore */ }
		currentPlayingAudio = null;
	}
	
	// Clear legacy queue
	audioQueue.forEach((audio) => {
		try { URL.revokeObjectURL(audio.src); } catch { /* ignore */ }
	});
	audioQueue = [];
	isPlayingQueue = false;
	isAudioPlaying = false;
}

/* ---------------------- Conversation Variables ---------------------- */
let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let isConversationActive = false;
let hasUserInteracted = false; // Track if user has interacted with the page
let currentAudio: HTMLAudioElement | null = null; // Current playing audio for interruption

let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

// WebSocket STT controller instance (started when realtime conversation begins)
type RealtimeSttController = {
	start: () => Promise<void>;
	stop: () => void;
	getWebSocket: () => unknown;
	send: (data: unknown) => void;
	forceReconnect: () => void;
} | null;
type VoiceResponse = {
	message_type?: string;
	type?: string;
	event?: string;
	text?: string;
	audio?: string;
	audio_base_64?: string;
	audio_base64?: string;
	action?: string;
	actionTarget?: string;
	actionData?: any;
	error?: any;
	needsDetails?: boolean;
};

let wsController: RealtimeSttController = null;

// Simple audio playback with HTML Audio elements
let audioQueue: HTMLAudioElement[] = [];
let isPlayingQueue = false;
let currentPlayingAudio: HTMLAudioElement | null = null;
let isAudioInterrupted = false; // Track if user interrupted AI audio
let firstChunkReceivedTime = 0;
let firstAudioPlayTime = 0;
let lastPartialResponseText: string = "";
let isAudioPlaying = false;
// Deduplication: Track recently processed transcripts to avoid duplicate processing
const recentTranscripts = new Map<string, number>(); // {text: timestamp}
const TRANSCRIPT_CACHE_TTL = 5000; // 5 seconds - ignore duplicates within 5 seconds

function playNextInQueue() {
	// Block playback if user interrupted
	if (isAudioInterrupted) {
		isPlayingQueue = false;
		currentPlayingAudio = null;
		return;
	}

	// Block playback if muted
	if (isMiraMuted) {
		isPlayingQueue = false;
		currentPlayingAudio = null;
		// Clear the queue when muted
		audioQueue.forEach((audio) => {
			try {
				URL.revokeObjectURL(audio.src);
			} catch {
				// Ignore errors when revoking URLs
			}
		});
		audioQueue = [];
		return;
	}

	if (audioQueue.length === 0) {
		isPlayingQueue = false;
		currentPlayingAudio = null;
		return;
	}

	isPlayingQueue = true;
	const audio = audioQueue.shift()!;
	currentPlayingAudio = audio;

	// Pre-buffer next chunk immediately when this one starts playing
	const preloadNext = () => {
		if (audioQueue.length > 0 && !isAudioInterrupted) {
			const nextAudio = audioQueue[0];
			// Trigger browser to start loading/decoding next chunk
			if (nextAudio.readyState < 2) {
				// If not already loaded
				nextAudio.load();
			}
		}
	};

	audio.onended = () => {
		try {
			URL.revokeObjectURL(audio.src);
		} catch {
			// Ignore errors when revoking URLs
		}
		currentPlayingAudio = null;
		// Don't continue queue if interrupted
		if (!isAudioInterrupted) {
			playNextInQueue();
		}
	};

	audio.onerror = () => {
		// Don't log error if we intentionally cleared the source during interruption
		if (!isAudioInterrupted) {
			console.error("❌ Audio error");
		}
		try {
			URL.revokeObjectURL(audio.src);
		} catch {
			// Ignore errors when revoking URLs
		}
		currentPlayingAudio = null;
		// Don't continue queue if interrupted
		if (!isAudioInterrupted) {
			playNextInQueue();
		}
	};

	audio
		.play()
		.then(() => {
			if (firstAudioPlayTime === 0 && firstChunkReceivedTime > 0) {
				firstAudioPlayTime = performance.now();
			}
			// Start pre-loading next chunk NOW while this one plays
			preloadNext();
		})
		.catch((err) => {
			console.error("❌ Play failed:", err);
			URL.revokeObjectURL(audio.src);
			currentPlayingAudio = null;
			playNextInQueue();
		});
}

function handleAudioChunk(base64: string) {
	try {
		if (isAudioInterrupted || isMiraMuted || !base64 || base64.length === 0) {
			return;
		}

		if (firstChunkReceivedTime === 0) {
			firstChunkReceivedTime = performance.now();
		}

		// Use the unified AudioManager
		audioManager.enqueue(base64, 'audio/mpeg');
	} catch (error) {
		console.error("❌ Failed to handle audio chunk:", error);
	}
}

// Convert AudioBuffer to WAV blob
// Note: This function is defined but currently unused - kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataLength, true);
	writeString(view, 8, "WAVE");
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true); // fmt chunk size
	view.setUint16(20, format, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true); // byte rate
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitDepth, true);
	writeString(view, 36, "data");
	view.setUint32(40, dataLength, true);

	// Write PCM samples
	const offset = 44;
	for (let i = 0; i < samples.length; i++) {
		for (let channel = 0; channel < numChannels; channel++) {
			const channelData = audioBuffer.getChannelData(channel);
			const sample = Math.max(-1, Math.min(1, channelData[i]));
			const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(
				offset + (i * numChannels + channel) * bytesPerSample,
				intSample,
				true
			);
		}
	}

	return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

function handleAudioFinal() {
	// Buffer queue will drain naturally
}

function stopAudioPlayback() {
	isAudioInterrupted = true;

	// Stop all audio via unified manager
	stopAllAudio();

	// Send stop signal to backend
	if (wsController && typeof wsController.send === "function") {
		try {
			void wsController.send({ message_type: "stop_audio" });
		} catch { /* ignore */ }
	}
}

function resetAudioState() {
	isAudioInterrupted = false;
	audioManager.reset();
	
	// Reset legacy state
	currentPlayingAudio = null;
	currentAudio = null;
	audioQueue = [];
	isPlayingQueue = false;
	isAudioPlaying = false;
	firstChunkReceivedTime = 0;
	firstAudioPlayTime = 0;
}

async function playAudio(base64: string) {
	// Don't play if muted
	if (isMiraMuted) {
		return;
	}

	try {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const blob = new Blob([bytes], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);
		audio.volume = 1.0;
		audio.onended = () => {
			URL.revokeObjectURL(url);
		};
		audio.onerror = () => {
			URL.revokeObjectURL(url);
		};
		await audio.play();
	} catch (error) {
		console.error("playAudio failed", error);
	}
}

/**
 * Play non-streaming audio (for calendar/email actions, etc.)
 * This clears any existing queue and plays the audio immediately
 */
function playNonStreamingAudio(audioBase64: string) {
	if (isMiraMuted) return;
	
	// Stop any current audio first
	audioManager.reset();
	stopAllAudio();
	
	// Use the AudioManager to play this audio
	audioManager.enqueue(audioBase64, 'audio/mpeg');
}

// Centralized server response processor used by both the realtime WS flow and
// the one-shot blob flow. Keeps conversation history, dispatches events,
// and plays TTS audio when provided.
async function processServerResponse(data: any) {
	try {
		if (!data) return;

		// Only log errors - reduce noise for normal flow

		// Handle ElevenLabs-specific message types (forwarded by server)
		const msgType = data.message_type || data.type || data.event;

		// Handle ElevenLabs session_started confirmation
		if (msgType === "session_started") {
			// Session is ready, we can start sending audio
			return; // Don't process as a regular response
		}

		// Handle ElevenLabs transcript messages (support a few variants)
		if (
			msgType === "partial_transcript" ||
			msgType === "transcription" ||
			msgType === "partial_transcription"
		) {
			// Real-time partial transcript - could show in UI as "typing" indicator
			// You might want to update UI with partial text here
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("miraPartialResponse", {
						detail: data.text || data.partial || "",
					})
				);
			}
			return;
		}

		// Handle partial_response from OpenAI stream
		if (msgType === "partial_response") {
			// Track first partial response for latency measurement
			if (firstChunkReceivedTime === 0) {
				firstChunkReceivedTime = performance.now();
			}

			// Skip empty partial responses
			if (!data.text || !data.text.trim()) {
				return;
			}
			lastPartialResponseText = data.text || "";

			// Dispatch event for UI
			if (typeof window !== "undefined") {
				window.dispatchEvent(
					new CustomEvent("miraPartialResponse", { detail: data.text || "" })
				);
			}
			return;
		}
		if (
			msgType === "committed_transcript" ||
			msgType === "committed_transcript_with_timestamps" ||
			msgType === "transcription" ||
			msgType === "final_transcript"
		) {
			// Final committed transcript - this is the complete transcription
			// Skip empty/null transcripts to prevent glitches
			if (!data.text || !data.text.trim()) {
				return;
			}

			// Deduplication: Skip if this exact transcript was processed recently
			const textNormalized = data.text.trim().toLowerCase();
			const currentTime = Date.now();
			const lastProcessedTime = recentTranscripts.get(textNormalized);

			if (
				lastProcessedTime &&
				currentTime - lastProcessedTime < TRANSCRIPT_CACHE_TTL
			) {
				return; // Don't process duplicate
			}

			// Mark as processed
			recentTranscripts.set(textNormalized, currentTime);

			// Clean old entries (keep cache size manageable)
			if (recentTranscripts.size > 50) {
				const cutoffTime = currentTime - TRANSCRIPT_CACHE_TTL;
				for (const [text, timestamp] of recentTranscripts.entries()) {
					if (timestamp < cutoffTime) {
						recentTranscripts.delete(text);
					}
				}
			}

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
		if (msgType === "audio_chunk" || msgType === "audio_final") {
			return;
		} // Log ElevenLabs upstream errors with helpful context
		if (
			msgType === "auth_error" ||
			(data.error &&
				(data.error.includes("authenticated") ||
					data.error.includes("ElevenLabs")))
		) {
			console.error(
				"🔴 ElevenLabs upstream authentication failed. This is a server-side issue:"
			);
			console.error("   1. Check server .env has ELEVENLABS_API_KEY=sk_...");
			console.error("   2. Restart server after .env changes");
			console.error("   3. Verify key is valid for ElevenLabs realtime STT");
			console.error("   4. Check server logs for upstream connection details");
			return; // Don't process error as regular response
		}

		if (msgType === "quota_exceeded_error") {
			console.error("⚠️ ElevenLabs quota exceeded:", data.error);
			return;
		}

		if (msgType === "error") {
			console.error("❌ ElevenLabs error:", data.error);
			return;
		}

		// Handle navigation actions (e.g., morning brief)
		if (data.action === "navigate" && data.actionTarget) {
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
				}
			} catch (e) {
				// Failed to dispatch calendar modify event
			}
		}

		// Handle dashboard navigation commands
		if (data.action === "dashboard_navigate") {
			try {
				const route = data.actionData?.route;
				if (route && typeof window !== "undefined") {
					// Dispatch navigation event
					window.dispatchEvent(
						new CustomEvent("miraDashboardNavigate", {
							detail: {
								route: route,
								destination: data.actionData?.destination,
							},
						})
					);
				}
			} catch (e) {
				// Failed to dispatch navigation event
			}

			// Play navigation audio if available
			const audioField =
				data.audio || data.audio_base_64 || data.audio_base64 || null;
			if (audioField && !isMiraMuted && hasUserInteracted) {
				playNonStreamingAudio(audioField);
			}
			return; // Exit early
		}

		if (data.action === "email_calendar_summary") {
			try {
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraEmailCalendarSummary", {
							detail: data.actionData ?? {},
						})
					);
				}
			} catch (e) {
				// Failed to dispatch email/calendar summary event
			}

			// CRITICAL FIX: Handle audio for calendar/email actions ONLY HERE (not in text processing below)
			// This prevents duplicate audio playback which causes quality issues
			const audioField =
				data.audio || data.audio_base_64 || data.audio_base64 || null;
			if (audioField && !isMiraMuted && hasUserInteracted) {
				playNonStreamingAudio(audioField);
			}
			return; // Exit early - don't process in the text section below
		}

		// Only process if we have meaningful text
		if (data.text && data.text.trim().length > 0 && !data.error) {
			if (data.userText && data.userText.trim().length > 0) {
				conversationHistory.push({ role: "user", content: data.userText });
			}
			conversationHistory.push({ role: "assistant", content: data.text });
			localStorage.setItem(
				"mira_conversation",
				JSON.stringify(conversationHistory)
			);

			// Play TTS audio if present (support `audio` or `audio_base_64` field names)
			// NOTE: This is for non-streaming responses only. Streaming audio uses handleAudioChunk.
			const audioField =
				data.audio || data.audio_base_64 || data.audio_base64 || null;
			if (audioField) {
				// Don't play if muted
				if (isMiraMuted) {
					return;
				}

				// Don't play if queue is already active
				if (isPlayingQueue || currentPlayingAudio) {
					return;
				}

				if (currentAudio) {
					currentAudio.pause();
					currentAudio.currentTime = 0;
					isAudioPlaying = false;
					currentAudio = null;
				}

				if (!hasUserInteracted) {
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
									console.error("Audio playback failed:", err);
									URL.revokeObjectURL(url);
								});
						} else {
							isAudioPlaying = false;
							currentAudio = null;
						}
					};

					audio.addEventListener("loadeddata", () => playAudio());
					if (audio.readyState >= 2) playAudio();

					// Fallback attempt after a short delay
					setTimeout(() => {
						if (audio.readyState >= 2 && audio.paused) playAudio();
					}, 100);
				} catch (err) {
					console.error("Audio creation/decode failed:", err);
				}
			}
		}
	} catch (err) {
		console.error("processServerResponse error:", err);
	}
}

function logDetailedError(prefix: string, err: unknown) {
	try {
		if (err instanceof Error) {
			console.error(prefix, {
				name: err.name,
				message: err.message,
				stack: err.stack,
			});
			return;
		}
		if (err && typeof err === "object") {
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
		console.error(prefix, "failed to log error", e, err);
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
							// Failed to play pending audio
							URL.revokeObjectURL(url);
						});
				} catch (err) {
					console.error("Error playing pending audio:", err);
					localStorage.removeItem("pending_audio");
				}
			}
		}

		isConversationActive = true;

		try {
			// initialize realtime STT client
			const token = await (async () => {
				try {
					return await getValidToken();
				} catch {
					return null;
				}
			})();
			wsController = createRealtimeSttClient({
				wsUrl: getWebSocketUrl(),
				token,
				chunkSize: 4096,
				onMessage: async (msg: unknown) => {
					await processServerResponse(msg as Record<string, unknown>);
				},
				onPartialResponse: (text: string) => {
					try {
						if (typeof window !== "undefined") {
							window.dispatchEvent(
								new CustomEvent("miraPartialResponse", { detail: text })
							);
						}
					} catch {}
				},
				onAudioChunk: (b64: string) => {
					try {
						handleAudioChunk(b64);
					} catch (err) {
						console.error("onAudioChunk handler failed", err);
					}
				},
				onAudioFinal: () => {
					try {
						handleAudioFinal();
					} catch (err) {
						console.error("onAudioFinal failed", err);
					}
				},
				onResponse: (text: string, audioB64?: string | null) => {
					try {
						if (audioB64 && !isMiraMuted) {
							// non-streaming audio, play as a single chunk (only if not muted)
							void playAudio(audioB64);
						}
						// also forward to the usual processor so conversation state updates
						void processServerResponse({ text, audio: audioB64 });
					} catch (err) {
						console.error("onResponse handler failed", err);
					}
				},
				onError: (err: unknown) => {
					try {
						logDetailedError("WS stt error:", err);
						// Reset conversation state on error to allow retry
						if (isConversationActive) {
							isConversationActive = false;
						}
					} catch (logErr) {
						console.error("WS stt error (logging failed)", logErr, err);
						// Reset state even if logging fails
						isConversationActive = false;
					}
				},
				onClose: (ev?: CloseEvent) => {
			// Reset conversation state if connection closed unexpectedly
			// Code 1006 means connection failed (no close frame received)
			if (ev && !ev.wasClean && ev.code === 1006) {
				isConversationActive = false;
			}
		},
		onStateChange: (state: ConnectionState) => {
					// Dispatch event for UI components
					if (typeof window !== "undefined") {
						window.dispatchEvent(
							new CustomEvent("wsStateChange", { detail: state })
						);
					}
				},
			});

			// Make wsController globally accessible for manual reconnection
			if (typeof window !== "undefined") {
				(
					window as Window & { wsController?: RealtimeSttController }
				).wsController = wsController;
			}

			try {
				await wsController.start();
			} catch (startError) {
				console.error("Failed to start WebSocket connection:", startError);
				isConversationActive = false;
				throw startError; // Re-throw to be caught by outer try-catch
			}

			// Keep loop alive while conversation active; monitor interruption
			while (isConversationActive) {
				// Monitor for interruption when audio is playing
				if (audioManager.isActive()) {
					await monitorForInterruption();
				}
				await new Promise((res) => setTimeout(res, 80)); // Check frequently
			}

		} catch (err) {
			logDetailedError("Conversation (realtime) error:", err);
			isConversationActive = false;
		}
	} catch (err) {
		logDetailedError("Conversation error:", err);
		isConversationActive = false;
	}
}

/* ---------------------- Stop Mira Voice ---------------------- */
export function stopMiraVoice(permanent: boolean = false) {
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

	// If permanent stop (e.g., switching to text mode), close WebSocket permanently
	if (permanent && wsController) {
		const ws = wsController.getWebSocket();
		if (ws && typeof (ws as any).close === 'function') {
			(ws as any).close(true); // true = permanent close, no reconnect
		}
		wsController = null;
	}

	stopVoice();
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
		if (!audioManager.isActive()) {
			resolve(false);
			return;
		}

		navigator.mediaDevices
			.getUserMedia({ 
				audio: { 
					echoCancellation: true, 
					noiseSuppression: true,
					autoGainControl: true 
				} 
			})
			.then((stream) => {
				const audioContext = new AudioContext();
				const source = audioContext.createMediaStreamSource(stream);
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 1024; // Smaller for faster processing
				source.connect(analyser);

				const bufferLength = analyser.frequencyBinCount;
				const dataArray = new Float32Array(bufferLength);

				let checkCount = 0;
				let highEnergyCount = 0;
				const maxChecks = 100;
				const energyThreshold = 0.06; // Tuned threshold

				const checkInterval = setInterval(() => {
					if (!audioManager.isActive()) {
						clearInterval(checkInterval);
						try { audioContext.close(); } catch { /* ignore */ }
						stream.getTracks().forEach((t) => t.stop());
						resolve(false);
						return;
					}

					analyser.getFloatTimeDomainData(dataArray);
					let sum = 0;
					for (let i = 0; i < bufferLength; i++) {
						sum += dataArray[i] * dataArray[i];
					}
					const rms = Math.sqrt(sum / bufferLength);

					if (rms > energyThreshold) {
						highEnergyCount++;
						if (highEnergyCount >= 2) { // Require 2 frames to avoid false positives
							stopAudioPlayback();
							clearInterval(checkInterval);
							try { audioContext.close(); } catch { /* ignore */ }
							stream.getTracks().forEach((t) => t.stop());
							resolve(true);
							return;
						}
					} else {
						highEnergyCount = Math.max(0, highEnergyCount - 1); // Decay slowly
					}

					checkCount++;
					if (checkCount >= maxChecks) {
						clearInterval(checkInterval);
						try { audioContext.close(); } catch { /* ignore */ }
						stream.getTracks().forEach((t) => t.stop());
						resolve(false);
					}
				}, 40); // Check every 40ms
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
// Note: This function is defined but currently unused - kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

				// Stop energy analysis and get stats
				const { maxEnergy, avgEnergy, speechFrames } = energyAnalyzer.stop();
				const audioBlob = new Blob(chunks, { type: "audio/webm" });

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

				const formData = new FormData();
				formData.append("audio", audioBlob, "user_input.webm");

				try {
					// Use WebSocket STT/TTS path instead of HTTP endpoint
					let data: any = null;

					try {
						const token = await (async () => {
							try {
								return await getValidToken();
							} catch {
								return null;
							}
						})();

						// Send recorded blob via websocket helper and await transcript-like response
						const wsResult = await sendBlobOnce(audioBlob, {
							wsUrl: getWebSocketUrl(),
							token,
							chunkSize: 4096,
							timeoutMs: 30000,
						});
						data = wsResult ?? {};
					} catch (e) {
						console.error("Voice pipeline WS error", e);
						resolve();
						return;
					}

					try {
						await processServerResponse(data);
					} catch (err) {
						console.error("Voice pipeline error:", err);
					}
				} catch (err) {
					console.error("Voice pipeline error:", err);
				}

				chunks.length = 0; // clear memory
				resolve();
			};

			// Start recording
			activeRecorder!.start();

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
