/** @format */

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
export async function playVoice(text: string) {
	try {
		stopVoice();

		const apiBase = (
			process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
		).replace(/\/+$/, "");

		const voiceUrl = `${apiBase}/tts/?text=${encodeURIComponent(text)}`;

		const res = await fetch(voiceUrl);
		if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

		const arrayBuffer = await res.arrayBuffer();
		const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);

		const audio = new Audio(url);
		currentAudio = audio;
		currentUrl = url;

		// 🔥 PLAY IMMEDIATELY
		const playPromise = audio.play();

		if (playPromise !== undefined) {
			playPromise.catch(() => {
				// fallback: wait for first click (autoplay block)
				document.addEventListener("click", () => audio.play(), { once: true });
			});
		}

		// cleanup
		audio.addEventListener("ended", () => {
			URL.revokeObjectURL(url);
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
	}
}
