// /** @format */
// import { NextResponse } from "next/server";
// import OpenAI from "openai";
// import axios from "axios";
// import fs from "fs";
// import path from "path";
// import os from "os";

// export const runtime = "nodejs"; // ensures Node.js runtime for fs/path

// const openai = new OpenAI({
// 	apiKey: process.env.OPENAI_API_KEY!,
// });

// // Load ElevenLabs credentials - check both server-side and public env vars
// const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
// const ELEVEN_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;

// // Debug: Log environment variable status (only in development)
// if (process.env.NODE_ENV !== 'production') {
// 	console.log("[ENV CHECK] ElevenLabs config:", {
// 		hasApiKey: !!ELEVEN_API_KEY,
// 		hasVoiceId: !!ELEVEN_VOICE_ID,
// 		apiKeyLength: ELEVEN_API_KEY?.length || 0,
// 		voiceIdLength: ELEVEN_VOICE_ID?.length || 0,
// 		availableEnvKeys: Object.keys(process.env).filter(k => k.includes('ELEVEN'))
// 	});
// }

// export async function POST(req: Request) {
// 	let tempFilePath: string | null = null;
	
// 	try {
// 		console.log("[VOICE] Received POST request");

// 		// 1️⃣ Extract form data
// 		const data = await req.formData();
// 		const audioFile = data.get("audio") as File;
// 		const history = data.get("history")
// 			? JSON.parse(data.get("history") as string)
// 			: [];

// 		if (!audioFile) {
// 			console.error("No audio file found in form data");
// 			return NextResponse.json(
// 				{ error: "No audio file received", text: null, audio: null },
// 				{ status: 200 }
// 			);
// 		}

// 		// 2️⃣ Save audio temporarily
// 		const arrayBuffer = await audioFile.arrayBuffer();
// 		const buffer = Buffer.from(arrayBuffer);

// 		// Use cross-platform temp directory
// 		const tempDir = os.tmpdir();
// 		tempFilePath = path.join(tempDir, `input_${Date.now()}.webm`);
		
// 		// Ensure temp directory exists
// 		if (!fs.existsSync(tempDir)) {
// 			fs.mkdirSync(tempDir, { recursive: true });
// 		}
		
// 		fs.writeFileSync(tempFilePath, buffer);
// 		console.log("Audio saved locally:", tempFilePath);

// 		const stats = fs.statSync(tempFilePath);
// 		console.log("File size:", stats.size, "bytes");

// 		// Increased threshold to filter out very short/silent recordings
// 		if (stats.size < 15000) {
// 			console.warn("Audio too short or likely silent — skipping Whisper:", stats.size);
			
// 			// Clean up temp file before early return
// 			if (tempFilePath && fs.existsSync(tempFilePath)) {
// 				try {
// 					fs.unlinkSync(tempFilePath);
// 				} catch (cleanupErr) {
// 					console.warn("Failed to cleanup temp file:", cleanupErr);
// 				}
// 			}
			
// 			return NextResponse.json({
// 				error: "Audio too short",
// 				userText: "",
// 				text: "",
// 				audio: null,
// 			});
// 		}

// 		// 3️⃣ Transcribe with Whisper (with retry)
// 		let userInput = "";
// 		for (let attempt = 1; attempt <= 2; attempt++) {
// 			try {
// 				console.log(`Attempt ${attempt}: Transcribing with Whisper...`);
// 				const transcription = await openai.audio.transcriptions.create({
// 					file: fs.createReadStream(tempFilePath),
// 					model: "whisper-1",
// 				});
// 				userInput = transcription.text?.trim() || "";
// 				if (userInput) break;
//             } catch (err) {
//                 const message = err instanceof Error ? err.message : String(err);
//                 console.error(`Whisper attempt ${attempt} failed:`, message);
// 				if (attempt === 2) {
// 					// Clean up temp file before early return
// 					if (tempFilePath && fs.existsSync(tempFilePath)) {
// 						try {
// 							fs.unlinkSync(tempFilePath);
// 						} catch (cleanupErr) {
// 							console.warn("Failed to cleanup temp file:", cleanupErr);
// 						}
// 					}
// 					return NextResponse.json({
// 						error: "Whisper decoding failed after retry",
// 						userText: "",
// 						text: "I had trouble understanding that audio.",
// 						audio: null,
// 					});
// 				}
// 			}
// 		}

// 		// Filter out meaningless transcriptions
// 		// Whisper sometimes transcribes silence/background noise as common filler words
// 		const trimmedInput = userInput.trim();
		
// 		// Block only clearly meaningless patterns
// 		const meaninglessPatterns = [
// 			/^[.\s]+$/, // Only dots/spaces
// 			/^[.,!?\-;:]+$/, // Only punctuation
// 		];
		
// 		const isMeaningless = meaninglessPatterns.some(pattern => pattern.test(trimmedInput));
		
// 		// Block very short single words that are common noise transcriptions
// 		// But allow legitimate short responses if they're part of conversation
// 		const suspiciousShortNoise = /^(uh|um|hmm|ah|eh|oh)$/i.test(trimmedInput);
		
// 		// Check if input is suspiciously short (likely noise)
// 		// Require at least 3 chars, or a word with 4+ letters
// 		const isTooShort = trimmedInput.length < 3;
		
// 		if (isMeaningless || suspiciousShortNoise || isTooShort) {
// 			console.log("⚠️ Ignored noise or meaningless input:", {
// 				input: userInput,
// 				reason: isMeaningless ? "meaningless pattern" : suspiciousShortNoise ? "suspicious noise word" : "too short",
// 				length: trimmedInput.length
// 			});
			
// 			// Clean up temp file before early return
// 			if (tempFilePath && fs.existsSync(tempFilePath)) {
// 				try {
// 					fs.unlinkSync(tempFilePath);
// 				} catch (cleanupErr) {
// 					console.warn("Failed to cleanup temp file:", cleanupErr);
// 				}
// 			}
			
// 			return NextResponse.json({
// 				text: "",
// 				audio: null,
// 				userText: "",
// 			});
// 		}

// 		userInput = trimmedInput;

// 		console.log("User said:", userInput);

// 		// 3.5️⃣ Check for voice commands before GPT processing
// 		const morningBriefKeywords = /(morning|daily|today).*(brief|summary|update)/i;
// 		const showBriefKeywords = /(show|give|tell|read).*(brief|summary|morning|daily)/i;
		
// 		if (morningBriefKeywords.test(userInput) || showBriefKeywords.test(userInput)) {
// 			console.log("🎯 Morning brief command detected");
// 			// Prepare spoken confirmation
// 			let navAudioBase64: string | null = null;
// 			try {
// 				if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
// 					throw new Error("Missing ElevenLabs config");
// 				}
// 				const elevenNav = await axios.post(
// 					`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
// 					{ text: "Opening your morning brief now.", model_id: "eleven_turbo_v2" },
// 					{
// 						headers: { Accept: "audio/mpeg", "xi-api-key": ELEVEN_API_KEY, "Content-Type": "application/json" },
// 						responseType: "arraybuffer",
// 					}
// 				);
// 				navAudioBase64 = Buffer.from(elevenNav.data).toString("base64");
//             } catch {
//                 console.warn("TTS for navigation failed, proceeding without audio");
// 			}
// 			return NextResponse.json({
// 				text: "Opening your morning brief now.",
// 				audio: navAudioBase64,
// 				userText: userInput,
// 				action: "navigate",
// 				actionTarget: "/scenarios/morning-brief",
// 			});
// 		}

// 		// 4️⃣ Build GPT conversation with enhanced system prompt for calendar actions
// 		const systemPrompt = {
// 			role: "system",
// 			content: `You are Mira, a warm, expressive, voice-first assistant. 
// 			Be conversational and empathetic. Respond naturally in spoken English.
// 			Keep answers concise (1–3 sentences max).
			
// 			If the user asks to modify calendar events (move, reschedule, cancel, delete, update), 
// 			respond with: "I can help you modify that event. Please specify which event and what changes you'd like."
// 			You can modify events mentioned in the morning brief.`,
// 		};

// 		const messages = [
// 			systemPrompt,
// 			...history,
// 			{ role: "user", content: userInput },
// 		];

// 		console.log("History received:", history.length, "messages");

// 		// 5️⃣ Generate GPT reply
// 		let responseText = "I'm here.";
// 		try {
// 			const completion = await openai.chat.completions.create({
// 				model: "gpt-4o-mini",
// 				messages,
// 				temperature: 0.8,
// 				max_tokens: 200,
// 			});
// 			responseText =
// 				completion.choices[0].message?.content?.trim() || "I'm here.";
// 			console.log("Mira replies:", responseText);
//         } catch (gptErr) {
//             const message = gptErr instanceof Error ? gptErr.message : String(gptErr);
//             console.error("GPT response generation failed:", message);
// 			responseText =
// 				"Sorry, something went wrong while generating my response.";
// 		}

// 		// 6️⃣ Generate ElevenLabs voice
// 		let audioBase64: string | null = null;
// 		try {
// 			// Validate API key and voice ID are present
// 			if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
// 				console.error("ElevenLabs credentials missing:", {
// 					hasApiKey: !!ELEVEN_API_KEY,
// 					hasVoiceId: !!ELEVEN_VOICE_ID,
// 				});
// 				throw new Error("ElevenLabs API key or Voice ID not configured");
// 			}

// 			const eleven = await axios.post(
// 				`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
// 				{
// 					text: responseText,
// 					model_id: "eleven_turbo_v2",
// 					voice_settings: {
// 						stability: 0.6,
// 						similarity_boost: 0.8,
// 						style: 0.3,
// 						use_speaker_boost: true,
// 					},
// 				},
// 				{
// 					headers: {
// 						"Accept": "audio/mpeg",
// 						"xi-api-key": ELEVEN_API_KEY,
// 						"Content-Type": "application/json",
// 					},
// 					responseType: "arraybuffer",
// 				}
// 			);

// 			if (eleven.data && eleven.data.length > 0) {
// 				audioBase64 = Buffer.from(eleven.data).toString("base64");
// 				console.log("✅ ElevenLabs audio generated successfully");
// 			} else {
// 				console.error("No audio returned from ElevenLabs");
// 			}
//         } catch (ttsErr) {
//             // Best-effort logging without relying on 'any'
//             const maybeAxios = ttsErr as unknown as { message?: string; response?: { status?: number; statusText?: string; data?: unknown } };
//             console.error("ElevenLabs TTS generation failed:", {
//                 message: (ttsErr instanceof Error ? ttsErr.message : maybeAxios?.message) || String(ttsErr),
//                 status: maybeAxios?.response?.status,
//                 statusText: maybeAxios?.response?.statusText,
//                 data: typeof maybeAxios?.response?.data === 'string' ? (maybeAxios.response.data as string).slice(0, 200) : undefined,
//             });
// 			// Don't throw - return text response even if TTS fails
// 		}

// 		// 7️⃣ Final response
// 		console.log("Returning text and audio to frontend");
		
// 		// Clean up temp file
// 		if (tempFilePath) {
// 			try {
// 				if (fs.existsSync(tempFilePath)) {
// 					fs.unlinkSync(tempFilePath);
// 					console.log("Temp file cleaned up:", tempFilePath);
// 				}
// 			} catch (cleanupErr) {
// 				console.warn("Failed to cleanup temp file:", cleanupErr);
// 			}
// 		}
		
// 		// 7️⃣ Check if response indicates calendar modification intent
// 		const calendarModKeywords = /(move|reschedule|cancel|delete|update|change).*(event|meeting|appointment)/i;
// 		const hasCalendarModIntent = calendarModKeywords.test(userInput) || calendarModKeywords.test(responseText);
		
// 		// Naive extraction for event name and time from user input (best-effort)
// 		let extractedQuery: string | undefined;
// 		let extractedAction: string | undefined;
// 		let extractedTime: string | undefined;
// 		if (hasCalendarModIntent) {
// 			const lower = userInput.toLowerCase();
// 			if (/cancel|delete/.test(lower)) extractedAction = "cancel";
// 			else if (/reschedule|move|change/.test(lower)) extractedAction = "reschedule";
// 			// Extract quoted event name if present
// 			const quoteMatch = userInput.match(/"([^"]+)"|'([^']+)'/);
// 			if (quoteMatch) extractedQuery = quoteMatch[1] || quoteMatch[2];
// 			// Fallback: grab words after 'the' up to 'meeting/event'
// 			if (!extractedQuery) {
// 				const m = lower.match(/the\s+(.+?)\s+(meeting|event)/);
// 				if (m) extractedQuery = m[1];
// 			}
// 			// Extract simple time phrases like 'tomorrow 2pm' or ISO-like
// 			const timeMatch = userInput.match(/tomorrow\s+\d{1,2}(?::\d{2})?\s*(am|pm)?|\d{4}-\d{2}-\d{2}t\d{2}:\d{2}/i);
// 			if (timeMatch) extractedTime = timeMatch[0];
// 		}
		
// 		return NextResponse.json({
// 			text: responseText,
// 			audio: audioBase64,
// 			userText: userInput,
// 			...(hasCalendarModIntent && { 
// 				action: "calendar_modify",
// 				needsDetails: !(extractedQuery && extractedAction),
// 				event_query: extractedQuery,
// 				calendar_action: extractedAction,
// 				new_time: extractedTime,
// 			}),
// 		});
//     } catch (error) {
//         const message = error instanceof Error ? error.message : String(error);
//         console.error("[VOICE ERROR]", message);
		
// 		// Clean up temp file on error if it was created
// 		if (tempFilePath) {
// 			try {
// 				if (fs.existsSync(tempFilePath)) {
// 					fs.unlinkSync(tempFilePath);
// 					console.log("Temp file cleaned up on error:", tempFilePath);
// 				}
// 			} catch (cleanupErr) {
// 				console.warn("Failed to cleanup temp file on error:", cleanupErr);
// 			}
// 		}
		
//         return NextResponse.json(
//             { error: "Voice processing failed", details: message },
// 			{ status: 500 }
// 		);
// 	}
// }
