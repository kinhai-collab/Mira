/** @format */

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentState: "idle" | "playing" | "paused" = "idle";

export async function playVoice(text: string) {
	try {
		stopVoice();

		const apiBase = (
			process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
		).replace(/\/+$/, "");
		const voiceUrl = `${apiBase}/tts/tts?text=${encodeURIComponent(
			text
		)}&mood=calm`;

		const res = await fetch(voiceUrl);
		if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);

		const arrayBuffer = await res.arrayBuffer();
		const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);

		const audio = new Audio(url);
		currentAudio = audio;
		currentUrl = url;
		currentState = "idle";

		audio.addEventListener("canplaythrough", async () => {
			await audio.play().catch(() => {
				document.addEventListener("click", () => audio.play(), { once: true });
			});
			currentState = "playing";
			console.log("Voice playback started");
		});

		audio.addEventListener("ended", () => {
			currentState = "idle";
			URL.revokeObjectURL(url);
			console.log("Voice playback finished");
		});
	} catch (err) {
		console.error("Voice playback failed:", err);
	}
}

export function stopVoice() {
	if (currentAudio) {
		currentAudio.pause();
		currentAudio.currentTime = 0;
		currentAudio = null;
		if (currentUrl) URL.revokeObjectURL(currentUrl);
		currentUrl = null;
		currentState = "idle";
	}
}
