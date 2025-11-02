/** @format */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import axios from "axios";
<<<<<<< HEAD
=======
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs"; // ensures Node.js runtime for fs/path
>>>>>>> 02d789d109aaf5884c05b1debe3a6401e122d64f

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY!,
});

<<<<<<< HEAD
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
=======
const BACKEND_TTS_URL = "http://127.0.0.1:8000/tts/tts";

export async function POST(req: Request) {
	let tempFilePath: string | null = null;
	
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

		// Use cross-platform temp directory
		const tempDir = os.tmpdir();
		tempFilePath = path.join(tempDir, `input_${Date.now()}.webm`);
		
		// Ensure temp directory exists
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		
		fs.writeFileSync(tempFilePath, buffer);
		console.log("Audio saved locally:", tempFilePath);

		const stats = fs.statSync(tempFilePath);
		console.log("File size:", stats.size, "bytes");

		if (stats.size < 8000) {
			console.warn("Audio too short — skipping Whisper:", stats.size);
			
			// Clean up temp file before early return
			if (tempFilePath && fs.existsSync(tempFilePath)) {
				try {
					fs.unlinkSync(tempFilePath);
				} catch (cleanupErr) {
					console.warn("Failed to cleanup temp file:", cleanupErr);
				}
			}
			
			return NextResponse.json({
				error: "Audio too short",
				userText: "",
				text: "I didn't quite catch that. Could you repeat?",
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
				if (attempt === 2) {
					// Clean up temp file before early return
					if (tempFilePath && fs.existsSync(tempFilePath)) {
						try {
							fs.unlinkSync(tempFilePath);
						} catch (cleanupErr) {
							console.warn("Failed to cleanup temp file:", cleanupErr);
						}
					}
					return NextResponse.json({
						error: "Whisper decoding failed after retry",
						userText: "",
						text: "I had trouble understanding that audio.",
						audio: null,
					});
				}
			}
		}

		if (!userInput || userInput.length < 3) {
			console.log("Ignored short or noisy input.");
			
			// Clean up temp file before early return
			if (tempFilePath && fs.existsSync(tempFilePath)) {
				try {
					fs.unlinkSync(tempFilePath);
				} catch (cleanupErr) {
					console.warn("Failed to cleanup temp file:", cleanupErr);
				}
			}
			
			return NextResponse.json({
				text: "I didn't quite hear you. Can you say that again?",
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
		
		// Clean up temp file
		if (tempFilePath) {
			try {
				if (fs.existsSync(tempFilePath)) {
					fs.unlinkSync(tempFilePath);
					console.log("Temp file cleaned up:", tempFilePath);
				}
			} catch (cleanupErr) {
				console.warn("Failed to cleanup temp file:", cleanupErr);
			}
		}
		
		return NextResponse.json({
			text: responseText,
			audio: audioBase64,
			userText: userInput,
		});
	} catch (error: any) {
		console.error("[VOICE ERROR]", error.message);
		
		// Clean up temp file on error if it was created
		if (tempFilePath) {
			try {
				if (fs.existsSync(tempFilePath)) {
					fs.unlinkSync(tempFilePath);
					console.log("Temp file cleaned up on error:", tempFilePath);
				}
			} catch (cleanupErr) {
				console.warn("Failed to cleanup temp file on error:", cleanupErr);
			}
		}
		
		return NextResponse.json(
			{ error: "Voice processing failed", details: error.message },
>>>>>>> 02d789d109aaf5884c05b1debe3a6401e122d64f
			{ status: 500 }
		);
	}
}
