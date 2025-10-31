/** @format */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";

export const runtime = "nodejs"; // ensures Node.js runtime for fs/path

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

const BACKEND_TTS_URL = "http://127.0.0.1:8000/tts/tts";

export async function POST(req: Request) {
	try {
		console.log("[VOICE] Received POST request");

		// 1️⃣ Extract form data
		const data = await req.formData();
		const audioFile = data.get("audio") as File;
		const history = data.get("history")
			? JSON.parse(data.get("history") as string)
			: [];

		if (!audioFile) {
			console.error("No audio file found in form data");
			return NextResponse.json(
				{ error: "No audio file received", text: null, audio: null },
				{ status: 200 }
			);
		}

		// 2️⃣ Save audio temporarily
		const arrayBuffer = await audioFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const tempFilePath = path.join("/tmp", `input_${Date.now()}.webm`);
		fs.writeFileSync(tempFilePath, buffer);
		console.log("Audio saved locally:", tempFilePath);

		const stats = fs.statSync(tempFilePath);
		console.log("File size:", stats.size, "bytes");

		if (stats.size < 8000) {
			console.warn("Audio too short — skipping Whisper:", stats.size);
			return NextResponse.json({
				error: "Audio too short",
				userText: "",
				text: "I didn’t quite catch that. Could you repeat?",
				audio: null,
			});
		}

		// 3️⃣ Transcribe with Whisper (with retry)
		let userInput = "";
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				console.log(`Attempt ${attempt}: Transcribing with Whisper...`);
				const transcription = await openai.audio.transcriptions.create({
					file: fs.createReadStream(tempFilePath),
					model: "whisper-1",
				});
				userInput = transcription.text?.trim() || "";
				if (userInput) break;
			} catch (err: any) {
				console.error(`Whisper attempt ${attempt} failed:`, err.message);
				if (attempt === 2)
					return NextResponse.json({
						error: "Whisper decoding failed after retry",
						userText: "",
						text: "I had trouble understanding that audio.",
						audio: null,
					});
			}
		}

		if (!userInput || userInput.length < 3) {
			console.log("Ignored short or noisy input.");
			return NextResponse.json({
				text: "I didn’t quite hear you. Can you say that again?",
				audio: null,
				userText: "",
			});
		}

		console.log("User said:", userInput);

		// 4️⃣ Build GPT conversation
		const systemPrompt = {
			role: "system",
			content: `You are Mira, a warm, expressive, voice-first assistant. 
			Be conversational and empathetic. Respond naturally in spoken English.
			Keep answers concise (1–3 sentences max).`,
		};

		const messages = [
			systemPrompt,
			...history,
			{ role: "user", content: userInput },
		];

		console.log("History received:", history.length, "messages");

		// 5️⃣ Generate GPT reply
		let responseText = "I'm here.";
		try {
			const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages,
				temperature: 0.8,
				max_tokens: 200,
			});
			responseText =
				completion.choices[0].message?.content?.trim() || "I'm here.";
			console.log("Mira replies:", responseText);
		} catch (gptErr: any) {
			console.error("GPT response generation failed:", gptErr.message);
			responseText =
				"Sorry, something went wrong while generating my response.";
		}

		// 6️⃣ Generate TTS audio
		let audioBase64: string | null = null;
		try {
			const ttsResponse = await axios.get(BACKEND_TTS_URL, {
				params: { text: responseText, mood: "calm" },
				responseType: "arraybuffer",
			});

			if (ttsResponse.data && ttsResponse.data.length > 0) {
				audioBase64 = Buffer.from(ttsResponse.data).toString("base64");
				console.log("✅ TTS audio generated successfully");
			} else {
				console.error("No TTS audio returned from backend");
			}
		} catch (ttsErr: any) {
			console.error("TTS generation failed:", ttsErr.message);
		}

		// 7️⃣ Final response
		console.log("Returning text and audio to frontend");
		return NextResponse.json({
			text: responseText,
			audio: audioBase64,
			userText: userInput,
		});
	} catch (error: any) {
		console.error("[VOICE ERROR]", error.message);
		return NextResponse.json(
			{ error: "Voice processing failed", details: error.message },
			{ status: 500 }
		);
	}
}
