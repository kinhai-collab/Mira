/** @format */
import { stopVoice } from "./voice";

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

let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

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
		
		// Check if there's pending audio from before interaction
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
					audio.play().then(() => {
						console.log("✅ Playing pending audio");
						localStorage.removeItem("pending_audio");
						audio.addEventListener("ended", () => URL.revokeObjectURL(url));
					}).catch((err) => {
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
		console.log("🎧 Conversation started.");

		while (isConversationActive) {
			await recordOnce();
			if (isConversationActive) {
				await new Promise((res) => setTimeout(res, 600));
			}
		}

		console.log("🪞 Conversation loop ended.");
	} catch (err) {
		console.error("Conversation error:", err);
		isConversationActive = false;
	}
}

/* ---------------------- Stop Mira Voice ---------------------- */
export function stopMiraVoice() {
	isConversationActive = false;

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
function analyzeAudioEnergy(stream: MediaStream): { stop: () => number } {
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let source: MediaStreamAudioSourceNode | null = null;
	let maxEnergy = 0;
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
			return maxEnergy;
		}
	};
}

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
				// Stop energy analysis and get max energy
				const maxEnergy = energyAnalyzer.stop();
				const audioBlob = new Blob(chunks, { type: "audio/webm" });
				
				console.log("🎙️ Segment recorded - size:", audioBlob.size, "bytes, energy:", maxEnergy.toFixed(2));

				// 💡 Skip short/silent audio (<15 KB) - increased threshold
				if (audioBlob.size < 15000) {
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
				// Typical speech energy is 5-30, background noise is usually <2
				if (maxEnergy < 3) {
					console.warn(
						"⚠️ Audio energy too low (likely silence/noise) — skipping Whisper request.",
						"Energy:",
						maxEnergy.toFixed(2)
					);
					chunks.length = 0;
					resolve();
					return;
				}

				const formData = new FormData();
				formData.append("audio", audioBlob, "user_input.webm");

                try {
                    const apiBase = (
                        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
                    ).replace(/\/+$/, "");
                    const res = await fetch(`${apiBase}/api/voice`, {
						method: "POST",
						body: formData,
					});

					if (!res.ok) {
						console.error("❌ Voice API error:", res.status, res.statusText);
						resolve();
						return;
					}

					const data = await res.json();
					console.log("🪞 Server response:", data);

					// Handle navigation actions (e.g., morning brief)
					if (data.action === "navigate" && data.actionTarget) {
						console.log("🧭 Navigating to:", data.actionTarget);
						// Small delay to ensure audio feedback plays
						setTimeout(() => {
							if (typeof window !== "undefined") {
								window.location.href = data.actionTarget;
							}
						}, 500);
						resolve();
						return;
					}

					// Handle calendar modification intents
					if (data.action === "calendar_modify") {
						try {
							const detail = {
								needsDetails: !!data.needsDetails,
								event_query: data.event_query || null,
								action: data.calendar_action || null,
								new_time: data.new_time || null,
							};
							if (typeof window !== "undefined") {
								window.dispatchEvent(new CustomEvent("miraCalendarModify", { detail }));
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

					// Only process if we have meaningful text (not empty or error)
					if (data.text && data.text.trim().length > 0 && !data.error) {
						if (data.userText && data.userText.trim().length > 0) {
							conversationHistory.push({ role: "user", content: data.userText });
						}
						conversationHistory.push({ role: "assistant", content: data.text });
						localStorage.setItem(
							"mira_conversation",
							JSON.stringify(conversationHistory)
						);

						// 🔊 Play TTS if available
						if (data.audio) {
							console.log("🔊 Audio received, hasUserInteracted:", hasUserInteracted);
							
							if (!hasUserInteracted) {
								console.warn("⚠️ Audio available but user hasn't interacted yet - storing for later");
								localStorage.setItem("pending_audio", data.audio);
								// Try to enable interaction - user clicked mic so this should work
								hasUserInteracted = true;
							}
							
							try {
								const audioBinary = atob(data.audio);
								const arrayBuffer = new ArrayBuffer(audioBinary.length);
								const view = new Uint8Array(arrayBuffer);
								for (let i = 0; i < audioBinary.length; i++) {
									view[i] = audioBinary.charCodeAt(i);
								}
								const blob = new Blob([view], { type: "audio/mpeg" });
								const url = URL.createObjectURL(blob);
								const audio = new Audio(url);
								
								console.log("🎵 Attempting to play audio, blob size:", blob.size, "bytes");
								
								// Set volume and ensure it's ready
								audio.volume = 1.0;
								audio.preload = "auto";
								
								// Wait for audio to be ready before playing
								const playAudio = () => {
									const playPromise = audio.play();
									if (playPromise !== undefined) {
										playPromise
											.then(() => {
												console.log("✅ Audio playback started successfully");
												// Clean up URL when done
												audio.addEventListener("ended", () => {
													console.log("🔇 Audio playback finished");
													URL.revokeObjectURL(url);
												});
												audio.addEventListener("error", () => {
													URL.revokeObjectURL(url);
												});
											})
											.catch((err) => {
												console.error("❌ Audio playback failed:", err);
												console.error("Error details:", {
													name: err.name,
													message: err.message,
													stack: err.stack
												});
												// Clean up URL if play failed
												URL.revokeObjectURL(url);
											});
									} else {
										console.warn("⚠️ audio.play() returned undefined");
									}
								};
								
								// Wait for audio to be ready
								audio.addEventListener("loadeddata", () => {
									console.log("📻 Audio data loaded, duration:", audio.duration);
									playAudio();
								});
								
								// Also try to play immediately if already loaded
								if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
									console.log("📻 Audio already loaded, playing immediately");
									playAudio();
								}
								
								audio.addEventListener("error", (e) => {
									console.error("❌ Audio error:", e);
									console.error("Audio error details:", {
										error: audio.error,
										code: audio.error?.code,
										message: audio.error?.message
									});
									URL.revokeObjectURL(url);
								});
								
								// Fallback: try to play after a short delay if loadeddata didn't fire
								setTimeout(() => {
									if (audio.readyState >= 2 && audio.paused) {
										console.log("📻 Fallback: Attempting to play after delay");
										playAudio();
									}
								}, 100);
							} catch (err) {
								console.error("❌ Audio creation/decode failed:", err);
								if (err instanceof Error) {
									console.error("Error details:", {
										name: err.name,
										message: err.message,
										stack: err.stack
									});
								}
							}
						} else {
							console.log("⚠️ No audio in response");
						}
					} else {
						console.log("No meaningful response, skipping update");
					}
				} catch (err) {
					console.error("Voice pipeline error:", err);
				}

				chunks.length = 0; // clear memory
				resolve();
			};

			// Start recording
			activeRecorder.start();
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
