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

let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

if (typeof window !== "undefined") {
	const stored = localStorage.getItem("mira_conversation");
	if (stored) conversationHistory = JSON.parse(stored);
}

/* ---------------------- Start Mira Voice ---------------------- */
export async function startMiraVoice() {
	try {
		if (isConversationActive) {
			console.log("Mira already active.");
			return;
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

/* ---------------------- Record → Send → Play Cycle ---------------------- */
async function recordOnce(): Promise<void> {
	return new Promise<void>(async (resolve, reject) => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			activeStream = stream;
			activeRecorder = new MediaRecorder(stream, {
				mimeType: "audio/webm;codecs=opus",
			});

			const chunks: BlobPart[] = [];

			activeRecorder.ondataavailable = (event: BlobEvent) => {
				if (event.data && event.data.size > 0) chunks.push(event.data);
			};

			activeRecorder.onstop = async () => {
				const audioBlob = new Blob(chunks, { type: "audio/webm" });
				console.log("🎙️ Segment recorded, size:", audioBlob.size);

				// 💡 Skip short/silent audio (<10 KB)
				if (audioBlob.size < 10000) {
					console.warn(
						"⚠️ Audio too short or silent — skipping Whisper request."
					);
					chunks.length = 0;
					resolve();
					return;
				}

				const formData = new FormData();
				formData.append("audio", audioBlob, "user_input.webm");

				try {
					const res = await fetch("/api/voice", {
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

					if (data.text) {
						conversationHistory.push({ role: "user", content: data.userText });
						conversationHistory.push({ role: "assistant", content: data.text });
						localStorage.setItem(
							"mira_conversation",
							JSON.stringify(conversationHistory)
						);
					}

					// 🔊 Play TTS if available
					if (data.audio) {
						const audioBinary = atob(data.audio);
						const arrayBuffer = new ArrayBuffer(audioBinary.length);
						const view = new Uint8Array(arrayBuffer);
						for (let i = 0; i < audioBinary.length; i++) {
							view[i] = audioBinary.charCodeAt(i);
						}
						const blob = new Blob([view], { type: "audio/mpeg" });
						const url = URL.createObjectURL(blob);
						const audio = new Audio(url);
						audio.play();
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
