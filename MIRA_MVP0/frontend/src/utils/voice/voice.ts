/** @format */
export async function playVoice(text: string) {
	try {
		const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
		const voiceUrl = `${apiBase}/api/voice?text=${encodeURIComponent(text)}`;
		console.log("Voice API URL:", voiceUrl);
		console.log("Environment:", process.env.NODE_ENV);
		console.log("API Base:", apiBase);
		
		const res = await fetch(voiceUrl);
		console.log("Voice API response status:", res.status);
		console.log("Voice API response headers:", res.headers);
		
		if (!res.ok) {
			const errorText = await res.text();
			console.error("Voice API failed:", res.status, errorText);
			throw new Error(`Voice API failed: ${res.status} - ${errorText}`);
		}

		const arrayBuffer = await res.arrayBuffer();
		console.log("Audio data received, size:", arrayBuffer.byteLength, "bytes");
		
		const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		console.log("Audio blob URL created:", url);
		
		const audio = new Audio(url);
		console.log("Audio element created");

		const tryPlay = () => {
			audio.play().catch((err) => console.warn("Autoplay blocked:", err));
			document.removeEventListener("click", tryPlay);
		};

		// Attempt immediate playback, otherwise wait for user interaction
		audio.play().catch(() => {
			document.addEventListener("click", tryPlay, { once: true });
		});
	} catch (err) {
		console.error("Voice playback failed:", err);
	}
}
