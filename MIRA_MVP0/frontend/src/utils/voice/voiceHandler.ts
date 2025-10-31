/** @format */
import { stopVoice } from "./voice";

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: BlobPart[] = [];
let micStream: MediaStream | null = null;

let isRecording = false;
let isSpeaking = false;
let userStopped = false;
let silenceTimer: NodeJS.Timeout | null = null;

let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

if (typeof window !== "undefined") {
	const stored = localStorage.getItem("mira_conversation");
	if (stored) conversationHistory = JSON.parse(stored);
}

/**
 * Start Mira listening (mic capture → /api/voice → TTS playback)
 */
export async function startMiraVoice() {
	try {
		if (isRecording || isSpeaking || userStopped) return;
		isRecording = true;
		console.log("Mira listening...");

		micStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				channelCount: 1,
			},
		});

		mediaRecorder = new MediaRecorder(micStream);
		audioChunks = [];

		const SILENCE_TIMEOUT_MS = 3000;

		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) audioChunks.push(event.data);
			if (silenceTimer) clearTimeout(silenceTimer);

			silenceTimer = setTimeout(() => {
				if (isRecording && !isSpeaking) {
					console.log("Silence timeout → stopping Mira.");
					stopMiraVoice(false);
				}
			}, SILENCE_TIMEOUT_MS);
		};

		mediaRecorder.onstop = async () => {
			if (!audioChunks.length || userStopped) return;

			const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
			const formData = new FormData();
			formData.append("audio", audioBlob);
			formData.append("history", JSON.stringify(conversationHistory));

			console.log("Sending audio + history:", conversationHistory.length);
			const res = await fetch("/api/voice", { method: "POST", body: formData });
			if (!res.ok) {
				console.error("Voice API failed", await res.text());
				return;
			}

			const data = await res.json();
			const userInput = data.userText?.trim() || "";

			if (!userInput || userInput.length < 3) {
				console.log("Ignored short input.");
				if (!userStopped) setTimeout(() => startMiraVoice(), 1500);
				return;
			}

			if (
				conversationHistory.length === 0 &&
				!/(\bhey mira\b|\bhi mira\b|\bhello mira\b)/i.test(userInput)
			) {
				console.log("Ignored input without wake phrase.");
				if (!userStopped) setTimeout(() => startMiraVoice(), 1500);
				return;
			}

			if (/(\bstop\b|\bcancel\b|\bnever mind\b)/i.test(userInput)) {
				console.log("Stop phrase detected.");
				stopMiraVoice(true);
				return;
			}

			const lastAssistant = conversationHistory
				.filter((m) => m.role === "assistant")
				.pop();
			if (
				lastAssistant &&
				lastAssistant.content
					.toLowerCase()
					.replace(/[^\w\s]/g, "")
					.includes(userInput.toLowerCase().replace(/[^\w\s]/g, ""))
			) {
				console.log("Echo detected — skipping.");
				if (!userStopped) setTimeout(() => startMiraVoice(), 2000);
				return;
			}

			conversationHistory.push({ role: "user", content: userInput });
			if (data.text)
				conversationHistory.push({ role: "assistant", content: data.text });
			localStorage.setItem(
				"mira_conversation",
				JSON.stringify(conversationHistory)
			);
			console.log("Updated history:", conversationHistory);

			// ---- Playback ----
			if (data.audio) {
				isSpeaking = true;
				stopMiraVoice(false);

				const audioData = atob(data.audio);
				const arrayBuffer = new ArrayBuffer(audioData.length);
				const view = new Uint8Array(arrayBuffer);
				for (let i = 0; i < audioData.length; i++) {
					view[i] = audioData.charCodeAt(i);
				}

				const blob = new Blob([view], { type: "audio/mpeg" });
				const url = URL.createObjectURL(blob);
				const audio = new Audio(url);

				audio.play().catch((err) => console.error("Playback error:", err));
				audio.onended = () => {
					URL.revokeObjectURL(url);
					isSpeaking = false;
					console.log("Mira finished speaking.");
					if (!userStopped) setTimeout(() => startMiraVoice(), 2000); // safe delayed re-listen
				};
			}
		};

		mediaRecorder.start();

		// safety stop
		setTimeout(() => {
			if (isRecording && !isSpeaking) stopMiraVoice(false);
		}, 8000);
	} catch (err) {
		console.error("Voice start failed:", err);
		isRecording = false;
	}
}

/**
 * Stop Mira completely
 */
export function stopMiraVoice(manual: boolean = true) {
	try {
		if (silenceTimer) clearTimeout(silenceTimer);
		if (mediaRecorder && mediaRecorder.state !== "inactive") {
			mediaRecorder.stop();
		}
		if (micStream) {
			micStream.getTracks().forEach((t) => t.stop());
			micStream = null;
		}

		isRecording = false;
		if (manual) {
			userStopped = true;
			isSpeaking = false;
		}

		stopVoice();
		console.log("Mira stopped listening/talking.");
	} catch (err) {
		console.error("Error stopping Mira voice:", err);
	}
}
