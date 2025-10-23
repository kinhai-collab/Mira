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
		console.log("Content-Type header:", res.headers.get('content-type'));
		console.log("Content-Length header:", res.headers.get('content-length'));
		
		if (!res.ok) {
			const errorText = await res.text();
			console.error("Voice API failed:", res.status, errorText);
			throw new Error(`Voice API failed: ${res.status} - ${errorText}`);
		}

		const arrayBuffer = await res.arrayBuffer();
		console.log("Audio data received, size:", arrayBuffer.byteLength, "bytes");
		
		// Check if the data looks like a valid MP3 file (starts with ID3 tag or MP3 sync word)
		const uint8Array = new Uint8Array(arrayBuffer);
		const isMP3 = uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0 || // MP3 sync word
		             uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33; // ID3 tag
		console.log("Audio data validation - looks like MP3:", isMP3);
		console.log("First 16 bytes:", Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
		
		// If it doesn't look like MP3, try to decode as base64
		let finalArrayBuffer = arrayBuffer;
		if (!isMP3) {
			console.log("Data doesn't look like MP3, checking if it's base64 encoded...");
			try {
				// Convert to string and check if it's base64
				const text = new TextDecoder().decode(arrayBuffer);
				if (/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
					console.log("Data appears to be base64 encoded, attempting to decode...");
					const decodedBytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
					console.log("Decoded bytes length:", decodedBytes.length);
					console.log("Decoded first 16 bytes:", Array.from(decodedBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
					
					// Check if decoded data looks like MP3
					const isDecodedMP3 = decodedBytes[0] === 0xFF && (decodedBytes[1] & 0xE0) === 0xE0 || // MP3 sync word
					                   decodedBytes[0] === 0x49 && decodedBytes[1] === 0x44 && decodedBytes[2] === 0x33; // ID3 tag
					
					if (isDecodedMP3) {
						console.log("✅ Decoded data looks like valid MP3!");
						finalArrayBuffer = decodedBytes.buffer;
					} else {
						console.log("❌ Decoded data still doesn't look like MP3");
					}
				}
			} catch (error) {
				console.log("Base64 decode failed:", error);
			}
		}
		
		// Create blob with proper MIME type for MP3
		const blob = new Blob([finalArrayBuffer], { type: "audio/mpeg" });
		const url = URL.createObjectURL(blob);
		console.log("Audio blob URL created:", url);
		
		// Create audio element and set source properly
		const audio = new Audio();
		audio.src = url;
		console.log("Audio element created with src:", audio.src);
		
		// Verify the blob is valid
		console.log("Blob details:", {
			size: blob.size,
			type: blob.type,
			url: url
		});

		// Add event listeners for debugging
		audio.addEventListener('loadstart', () => console.log('Audio load started'));
		audio.addEventListener('loadeddata', () => console.log('Audio data loaded'));
		audio.addEventListener('canplay', () => console.log('Audio can play'));
		audio.addEventListener('error', (e) => {
			console.error('Audio error:', e);
			console.error('Audio error details:', {
				error: audio.error,
				networkState: audio.networkState,
				readyState: audio.readyState,
				src: audio.src
			});
		});
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
			clearTimeout(loadTimeout); // Clear the timeout since audio loaded successfully
			audio.play()
				.then(() => {
					console.log("Audio playing successfully!");
				})
				.catch((err) => {
					console.warn("Autoplay blocked, waiting for user interaction:", err);
					document.addEventListener("click", tryPlay, { once: true });
				});
		});

		// Add a timeout to detect if audio fails to load
		const loadTimeout = setTimeout(() => {
			if (audio.readyState === 0) {
				console.error("Audio failed to load within timeout");
				// Try alternative approach with different MIME type
				console.log("Trying alternative audio format...");
				const altBlob = new Blob([finalArrayBuffer], { type: "audio/mp3" });
				const altUrl = URL.createObjectURL(altBlob);
				audio.src = altUrl;
				console.log("Retrying with alternative format:", altUrl);
			}
		}, 3000);

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
