/** @format */
export async function playVoice(text: string) {
	try {
		const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
		const voiceUrl = `${apiBase}/api/voice?text=${encodeURIComponent(text)}`;
		
		const res = await fetch(voiceUrl);
		
		if (!res.ok) {
			const errorText = await res.text();
			console.error("Voice API failed:", res.status, errorText);
			throw new Error(`Voice API failed: ${res.status} - ${errorText}`);
		}

		const arrayBuffer = await res.arrayBuffer();
		
		// Check if the data looks like a valid MP3 file (starts with ID3 tag or MP3 sync word)
		const uint8Array = new Uint8Array(arrayBuffer);
		const isMP3 = uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0 || // MP3 sync word
		             uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33; // ID3 tag
		
		// If it doesn't look like MP3, try to decode as base64
		let finalArrayBuffer = arrayBuffer;
		if (!isMP3) {
			try {
				// Convert to string and check if it's base64
				const text = new TextDecoder().decode(arrayBuffer);
				if (/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
					const decodedBytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
					
					// Check if decoded data looks like MP3
					const isDecodedMP3 = decodedBytes[0] === 0xFF && (decodedBytes[1] & 0xE0) === 0xE0 || // MP3 sync word
					                   decodedBytes[0] === 0x49 && decodedBytes[1] === 0x44 && decodedBytes[2] === 0x33; // ID3 tag
					
					if (isDecodedMP3) {
						finalArrayBuffer = decodedBytes.buffer;
					}
				}
			} catch (error) {
				// Silent fail - continue with original data
			}
		}
		
		// Create blob with proper MIME type for MP3
		const blob = new Blob([finalArrayBuffer], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		
		// Create audio element and set source properly
		const audio = new Audio();
		audio.src = url;

		// Add event listeners for debugging
		audio.addEventListener('loadstart', () => {});
		audio.addEventListener('loadeddata', () => {});
		audio.addEventListener('canplay', () => {});
		audio.addEventListener('error', (e) => {
			console.error('Audio playback failed:', e);
		});
		audio.addEventListener('ended', () => {});

		const tryPlay = () => {
			audio.play()
				.then(() => {
					// Audio playing successfully
				})
				.catch((err) => {
					// Try again with user interaction
					document.addEventListener("click", tryPlay, { once: true });
				});
			document.removeEventListener("click", tryPlay);
		};

		// Wait for audio to be ready, then try to play
		audio.addEventListener('canplay', () => {
			clearTimeout(loadTimeout); // Clear the timeout since audio loaded successfully
			audio.play()
				.then(() => {
					// Audio playing successfully
				})
				.catch((err) => {
					// Autoplay blocked, waiting for user interaction
					document.addEventListener("click", tryPlay, { once: true });
				});
		});

		// Add a timeout to detect if audio fails to load
		const loadTimeout = setTimeout(() => {
			if (audio.readyState === 0) {
				// Try alternative approach with different MIME type
				const altBlob = new Blob([finalArrayBuffer], { type: "audio/mp3" });
				const altUrl = URL.createObjectURL(altBlob);
				audio.src = altUrl;
			}
		}, 3000);

		// Fallback: try to play immediately as well
		setTimeout(() => {
			audio.play()
				.then(() => {
					// Fallback play successful
				})
				.catch((err) => {
					// Fallback play also blocked
				});
		}, 100);

		// Brave-specific: Try multiple times with different approaches
		setTimeout(() => {
			// Try to play with a simulated user gesture
			const playPromise = audio.play();
			if (playPromise !== undefined) {
				playPromise
					.then(() => {
						// Brave fallback successful
					})
					.catch((err) => {
						// Brave fallback failed
					});
			}
		}, 500);
	} catch (err) {
		console.error("Voice playback failed:", err);
	}
}
