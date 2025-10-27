/** @format */

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let isConversationActive = false;
let activeAudio: HTMLAudioElement | null = null;
let isMuted = false; // Track mute state globally

/**
 * Starts continuous conversation loop:
 * Mira listens → transcribes → replies → speaks → listens again
 * until user stops manually.
 */
async function startConversationLoop(): Promise<void> {
	try {
		if (isConversationActive) {
			console.log("⚠️ Conversation already active.");
			return;
		}

		isConversationActive = true;
		console.log("🎙️ Conversation started.");

		while (isConversationActive) {
			await recordOnce();

			if (isConversationActive) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		console.log("🛑 Conversation loop ended.");
	} catch (err) {
		console.error("🎙️ Conversation error:", err);
		isConversationActive = false;
	}
}

/** Stops Mira’s conversation loop and all active audio streams. */
function stopConversationLoop(): void {
	isConversationActive = false;

	if (activeRecorder && activeRecorder.state === "recording") {
		activeRecorder.stop();
	}

	if (activeStream) {
		activeStream.getTracks().forEach((track) => track.stop());
		activeStream = null;
	}

	// Stop Mira’s current voice playback if it’s still talking
	if (activeAudio) {
		activeAudio.pause();
		activeAudio.currentTime = 0;
		activeAudio = null;
	}

	console.log("🛑 Conversation manually stopped.");
}

/** Records one short clip, sends to backend, plays reply. */
async function recordOnce(): Promise<void> {
	return new Promise<void>(async (resolve, reject) => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			activeStream = stream;
			activeRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

			const chunks: BlobPart[] = [];

			activeRecorder.ondataavailable = (event: BlobEvent) => {
				if (event.data && event.data.size > 0) chunks.push(event.data);
			};

			activeRecorder.onstop = async () => {
				try {
					const blob = new Blob(chunks, { type: "audio/webm" });
					if (blob.size === 0) {
						console.warn("⚠️ Empty recording skipped.");
						resolve();
						return;
					}

					console.log("🎧 Segment recorded, size:", blob.size);

					const formData = new FormData();
					formData.append("audio", blob, "query.webm");

					console.log("📤 Sending audio to backend...");
					const res = await fetch("/api/voice", {
						method: "POST",
						body: formData,
					});

					if (!res.ok) {
						console.error("❌ Voice API error:", res.statusText);
						resolve();
						return;
					}

					// Dispatch text messages to UI for conversation update (if JSON present)
					const raw = await res.clone().arrayBuffer();
					const text = new TextDecoder().decode(raw);
					const [jsonPart, audioPart] = text.split("--MIRA_AUDIO_BOUNDARY--");

					try {
						const meta = JSON.parse(jsonPart);
						window.dispatchEvent(
							new CustomEvent("miraMessage", {
								detail: { userText: meta.user, miraText: meta.mira },
							})
						);
						console.log("📩 Dispatched miraMessage:", meta);
					} catch {
						console.warn("⚠️ No JSON found in response — audio-only mode");
					}

					// 🗣️ Play Mira’s response
					const audioBlob = await res.blob();
					const audioUrl = URL.createObjectURL(audioBlob);

					// Stop any previous playback before starting new one
					if (activeAudio) {
						activeAudio.pause();
						activeAudio.currentTime = 0;
					}

					activeAudio = new Audio(audioUrl);
					activeAudio.volume = isMuted ? 0 : 1;

					activeAudio.onended = () => {
						if (isConversationActive) {
							console.log("🎙️ Mira finished speaking — re-listening...");
						}
						resolve();
					};

					try {
						await activeAudio.play();
						console.log("🔊 Mira is speaking...");
					} catch (err) {
						console.error("⚠️ Playback error:", err);
						resolve();
					}
				} catch (error) {
					console.error("⚠️ General audio handling error:", error);
					resolve();
				}
			};

			activeRecorder.start();
			console.log("🎤 Listening...");

			setTimeout(() => {
				try {
					if (activeRecorder && activeRecorder.state === "recording") {
						activeRecorder.stop();
					}
					stream.getTracks().forEach((track) => track.stop());
				} catch (stopErr) {
					console.warn("⚠️ Stop error:", stopErr);
				}
			}, 5000);
		} catch (err) {
			console.error("⚠️ Recording error:", err);
			reject(err);
		}
	});
}

/** Toggle mute function — toggles Mira’s playback audio */
function toggleMute(): void {
	isMuted = !isMuted;

	if (activeAudio) {
		activeAudio.volume = isMuted ? 0 : 1;
	}

	console.log(isMuted ? "🔇 Mira muted" : "🔊 Mira unmuted");
}

// Export cleanly
export { startConversationLoop, stopConversationLoop, toggleMute };

// Backward compatibility for other files
export const startRecording = startConversationLoop;
export const stopRecording = stopConversationLoop;
