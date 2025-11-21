/** @format */

"use client";
import { useState, useRef } from "react";

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

			const apiBase =
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
			const res = await fetch(`${apiBase}/api/voice`, {
				method: "POST",
				body: formData,
			});
			const audio = await res.blob();
			const url = URL.createObjectURL(audio);
			const audioEl = new Audio(url);
			audioEl.play();

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
