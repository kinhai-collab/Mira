/** @format */

"use client";
import { useState, useRef } from "react";
import { getValidToken } from "@/utils/auth";
import { sendBlobOnce } from "@/utils/voice/wsVoiceStt";
import { getWebSocketUrl } from "@/utils/voice/websocketUrl";

export default function VoiceHandler() {
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunks = useRef<Blob[]>([]);

	async function startRecording() {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const recorder = new MediaRecorder(stream);
		recorder.start();
		setIsRecording(true);

		recorder.ondataavailable = (event) => audioChunks.current.push(event.data);

		recorder.onstop = async () => {
			const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
			const formData = new FormData();
			formData.append("audio", audioBlob, "user_input.webm");

			// Try to get a valid token and send it in the Authorization header if available
			const headers: Record<string, string> = {};
			try {
				const token = await getValidToken();
				if (token) headers.Authorization = `Bearer ${token}`;
			} catch (e) {
				// token retrieval failed — proceed without header
				console.warn('Could not get auth token for voice request', e);
			}

			try {
				const token = await (async () => { try { return await getValidToken(); } catch { return null; } })();
				const result = await sendBlobOnce(audioBlob, {
					wsUrl: getWebSocketUrl(),
					token,
					chunkSize: 4096,
					timeoutMs: 30000,
				});
				// If server returned base64 audio, play it; otherwise log transcript
				if (result && typeof result === 'object' && 'audio' in result && typeof result.audio === 'string') {
					try {
						const audioBinary = atob(result.audio);
						const arrayBuffer = new ArrayBuffer(audioBinary.length);
						const view = new Uint8Array(arrayBuffer);
						for (let i = 0; i < audioBinary.length; i++) view[i] = audioBinary.charCodeAt(i);
						const blob = new Blob([view], { type: 'audio/mpeg' });
						const url = URL.createObjectURL(blob);
						const audioEl = new Audio(url);
						audioEl.play().catch((e) => console.warn('Audio play failed', e));
					} catch (e) {
						console.warn('Failed to decode/play audio from server', e, result);
					}
				} else {
					console.log('WS result:', result);
				}
			} catch (e) {
				console.error('Voice WS upload failed', e);
			}

			audioChunks.current = [];
			setIsRecording(false);
		};

		mediaRecorderRef.current = recorder;
	}

	function stopRecording() {
		mediaRecorderRef.current?.stop();
	}

	return (
		<div className="flex flex-col items-center mt-4">
			<button
				onClick={isRecording ? stopRecording : startRecording}
				className={`px-6 py-3 rounded-full text-white ${
					isRecording ? "bg-red-600" : "bg-purple-600"
				}`}
			>
				{isRecording ? "Stop Recording" : "Talk to Mira 🎙️"}
			</button>
		</div>
	);
}
