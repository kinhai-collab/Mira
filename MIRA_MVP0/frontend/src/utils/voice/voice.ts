/** @format */
export async function playVoice(text: string) {
	try {
		const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
		const res = await fetch(
			`${apiBase}/voice?text=${encodeURIComponent(text)}`
		);
		if (!res.ok) throw new Error("Voice API failed");

		const arrayBuffer = await res.arrayBuffer();
		const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);

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
