/** @format */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID!;

export async function POST(req: Request) {
	try {
		// 1️⃣ Receive audio
		const data = await req.formData();
		const audioFile = data.get("audio");

		if (!audioFile || !(audioFile instanceof File)) {
			return NextResponse.json(
				{ error: "No valid audio file" },
				{ status: 400 }
			);
		}

		const buffer = Buffer.from(await audioFile.arrayBuffer());
		console.log("🪞 Step 1: Received audio, size =", buffer.length);

		// 2️⃣ Transcribe with Whisper
		console.log("🪞 Step 2: Sending to Whisper...");
		const audioForWhisper = new File([buffer], "audio.webm", {
			type: "audio/webm",
		});
		const transcription = await openai.audio.transcriptions.create({
			file: audioForWhisper,
			model: "whisper-1",
		});

		const userText = transcription.text.trim();
		console.log("🪞 Step 2 ✅ Whisper response:", userText);
		if (!userText)
			return NextResponse.json(
				{ error: "Empty transcription" },
				{ status: 400 }
			);

		// 3️⃣ GPT response
		console.log("🪞 Step 3: Sending to GPT...");
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content:
						"You are Mira — a warm, natural, and expressive personal assistant.",
				},
				{ role: "user", content: userText },
			],
		});
		const miraText = completion.choices[0]?.message?.content ?? "I'm here.";
		console.log("🪞 Step 3 ✅ GPT response:", miraText);

		// 4️⃣ Generate ElevenLabs voice
		console.log("🪞 Step 4: Sending to ElevenLabs...");
		const eleven = await axios.post(
			`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
			{ text: miraText },
			{
				headers: {
					"xi-api-key": ELEVEN_API_KEY,
					"Content-Type": "application/json",
				},
				responseType: "arraybuffer",
			}
		);
		console.log("🪞 Step 4 ✅ ElevenLabs audio ready.");

		// 5️⃣ Return **JSON metadata header** + **audio body**
		const jsonHeader = JSON.stringify({ user: userText, mira: miraText });
		const audioBuffer = Buffer.from(eleven.data);

		// Compose: JSON → delimiter → audio
		const boundary = "\n\n--MIRA_AUDIO_BOUNDARY--\n\n";
		const body = Buffer.concat([
			Buffer.from(jsonHeader, "utf8"),
			Buffer.from(boundary, "utf8"),
			audioBuffer,
		]);

		return new Response(body, {
			headers: { "Content-Type": "application/octet-stream" },
		});
	} catch (err: any) {
		console.error("Voice pipeline error:", err?.response?.data || err);
		return NextResponse.json(
			{ error: err?.message || "Voice pipeline failed" },
			{ status: 500 }
		);
	}
}
