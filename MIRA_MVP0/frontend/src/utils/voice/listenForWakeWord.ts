/** @format */

import { startMiraVoice } from "./voiceHandler";

export async function listenForWakeWord() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const audioContext = new AudioContext();
		const source = audioContext.createMediaStreamSource(stream);
		const processor = audioContext.createScriptProcessor(4096, 1, 1);

		source.connect(processor);
		processor.connect(audioContext.destination);

		console.log("🎧 Listening for 'Hey Mira'...");

		let listening = true;

		processor.onaudioprocess = async (event) => {
			if (!listening) return;
			const inputData = event.inputBuffer.getChannelData(0);
			const rms =
				Math.sqrt(inputData.reduce((s, x) => s + x * x, 0) / inputData.length) *
				100;

			if (rms > 12) {
				console.log("🟣 Wake word detected – start recording...");
				listening = false;
				processor.disconnect();
				source.disconnect();

                await startMiraVoice();

				setTimeout(() => {
					console.log("✅ Ready to listen again...");
					listenForWakeWord(); // restart listening loop
				}, 3000);
			}
		};
	} catch (error) {
		console.error("🎙️ Mic access or wake word error:", error);
	}
}
