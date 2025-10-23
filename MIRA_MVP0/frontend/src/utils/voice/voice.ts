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

		// Add event listeners for debugging
		audio.addEventListener('loadstart', () => console.log('Audio load started'));
		audio.addEventListener('loadeddata', () => console.log('Audio data loaded'));
		audio.addEventListener('canplay', () => console.log('Audio can play'));
		audio.addEventListener('error', (e) => console.error('Audio error:', e));
		audio.addEventListener('ended', () => console.log('Audio playback ended'));

		const tryPlay = () => {
			console.log("Attempting to play audio...");
			audio.play()
				.then(() => {
					console.log("Audio playing successfully!");
				})
				.catch((err) => {
					console.warn("Audio play failed:", err);
					// Try again with user interaction
					document.addEventListener("click", tryPlay, { once: true });
				});
			document.removeEventListener("click", tryPlay);
		};

		// Wait for audio to be ready, then try to play
		audio.addEventListener('canplay', () => {
			console.log("Audio ready, attempting to play...");
			audio.play()
				.then(() => {
					console.log("Audio playing successfully!");
				})
				.catch((err) => {
					console.warn("Autoplay blocked, waiting for user interaction:", err);
					document.addEventListener("click", tryPlay, { once: true });
				});
		});

		// Fallback: try to play immediately as well
		setTimeout(() => {
			console.log("Fallback: attempting immediate play...");
			audio.play()
				.then(() => {
					console.log("Fallback play successful!");
				})
				.catch((err) => {
					console.log("Fallback play also blocked:", err.message);
				});
		}, 100);

		// Brave-specific: Try multiple times with different approaches
		setTimeout(() => {
			console.log("Brave fallback: trying with user gesture simulation...");
			// Try to play with a simulated user gesture
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				playPromise
					.then(() => console.log("Brave fallback successful!"))
					.catch((err) => {
						console.log("Brave fallback failed:", err.message);
						// Show a message to user to click to play
						console.log("Please click anywhere on the page to play the voice");
					});
			}
		}, 500);
	} catch (err) {
		console.error("Voice playback failed:", err);
	}
}
