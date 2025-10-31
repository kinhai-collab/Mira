/** @format */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

// FastAPI backend TTS route
const BACKEND_TTS_URL = "http://127.0.0.1:8000/tts/tts";

export async function POST(req: Request) {
	try {
		console.log("[VOICE] Received POST request");

		// 1. Extract form data
		const data = await req.formData();
		const audioFile = data.get("audio") as File;
		const history = data.get("history")
			? JSON.parse(data.get("history") as string)
			: [];

		if (!audioFile) {
			return NextResponse.json(
				{ error: "No audio file received" },
				{ status: 400 }
			);
		}

		// 2. Save audio temporarily
		const arrayBuffer = await audioFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		const tempFilePath = path.join("/tmp", `input_${Date.now()}.webm`);
		fs.writeFileSync(tempFilePath, buffer);

		console.log("Audio file saved locally");

		// 3. Transcribe voice → text (Whisper)
		const transcription = await openai.audio.transcriptions.create({
			file: fs.createReadStream(tempFilePath),
			model: "whisper-1",
		});

		const userInput = transcription.text?.trim() || "";
		console.log("User said:", userInput);

		// --- Noise filter ---
		if (!userInput || userInput.length < 3) {
			console.log("Ignored noise/short input.");
			return NextResponse.json({ text: null, audio: null, userText: "" });
		}

		// 4. Build full conversation context
		const systemPrompt = {
			role: "system",
			content: `You are Mira, a warm, voice-first personal assistant. 
			Stay conversational and empathetic. 
			Do not repeat greetings once the conversation has started. 
			Keep answers brief and natural, as if speaking aloud.`,
		};

		const messages = [
			systemPrompt,
			...history,
			{ role: "user", content: userInput },
		];

		console.log("History received:", history.length, "messages");

		// 5. Generate GPT response
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages,
			temperature: 0.8,
			max_tokens: 200,
		});

		const responseText =
			completion.choices[0].message?.content?.trim() || "I'm here.";
		console.log("Mira replies:", responseText);

		// 6. Generate TTS audio from backend
		const ttsResponse = await axios.get(BACKEND_TTS_URL, {
			params: { text: responseText, mood: "calm" },
			responseType: "arraybuffer",
		});

		if (!ttsResponse.data || ttsResponse.data.length === 0) {
			console.error("No TTS audio returned from backend");
			return NextResponse.json({
				text: responseText,
				audio: null,
				userText: userInput,
			});
		}

		// 7. Convert binary → base64
		const audioBase64 = Buffer.from(ttsResponse.data).toString("base64");

		console.log("Returning audio + text to frontend");
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
