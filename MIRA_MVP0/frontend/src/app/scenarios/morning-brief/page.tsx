/** @format */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Orb from "./components/Orb";
import ThinkingPanel from "./components/ThinkingPanel";
import RecommendationPanel from "./components/RecommendationPanel";
import ConfirmationPanel from "./components/ConfirmationPanel";
import {
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
} from "@/utils/voice/voiceHandler";
import { getValidToken, requireAuth } from "@/utils/auth";

interface MorningBriefData {
	text: string;
	audio_path?: string;
	audio_url?: string;
	audio_base64?: string;
	user_name: string;
}

export default function MorningBrief() {
	const router = useRouter();
	const [stage, setStage] = useState<
		"thinking" | "recommendation" | "confirmation"
	>("thinking");

	const [isListening, setIsListening] = useState(false); // Start with mic OFF
	const [isMuted, setIsMuted] = useState(false);
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [briefData, setBriefData] = useState<MorningBriefData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	
	const playAudio = () => {
		if (!audioRef.current) return;
		
		// Prefer base64 audio (works in Lambda)
		if (briefData?.audio_base64) {
			try {
				const audioBinary = atob(briefData.audio_base64);
				const arrayBuffer = new ArrayBuffer(audioBinary.length);
				const view = new Uint8Array(arrayBuffer);
				for (let i = 0; i < audioBinary.length; i++) {
					view[i] = audioBinary.charCodeAt(i);
				}
				const blob = new Blob([view], { type: "audio/mpeg" });
				const url = URL.createObjectURL(blob);
				audioRef.current.src = url;
				audioRef.current.play().catch((err) => {
					console.error("Error playing audio:", err);
				});
				// Clean up URL when done
				audioRef.current.addEventListener("ended", () => {
					URL.revokeObjectURL(url);
				}, { once: true });
			} catch (err) {
				console.error("Error decoding base64 audio:", err);
			}
		} else if (briefData?.audio_url) {
			// Fallback to URL if base64 not available
			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");
			const fullAudioUrl = `${apiBase}${briefData.audio_url}`;
			audioRef.current.src = fullAudioUrl;
			audioRef.current.play().catch((err) => {
				console.error("Error playing audio:", err);
			});
		}
	};

	// Handle calendar modification from voice commands
	const handleCalendarModify = async (eventName: string, action: string, newTime?: string) => {
		try {
			const token = await getValidToken();
			if (!token) {
				setError("Not authenticated");
				return;
			}

			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");

			const params = new URLSearchParams({
				event_query: eventName,
				action: action,
			});
			if (newTime) {
				params.append("new_time", newTime);
			}

			const response = await fetch(
				`${apiBase}/calendar/modify-event?${params.toString()}`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
				throw new Error(errorData.detail || `HTTP ${response.status}`);
			}

			const result = await response.json();
			console.log("Calendar modification result:", result);
			// Could show a toast/notification here
		} catch (err) {
			console.error("Error modifying calendar event:", err);
			setError(err instanceof Error ? err.message : "Failed to modify event");
		}
	};

	// Check authentication
	useEffect(() => {
		if (!requireAuth(router)) return;
	}, [router]);
	
	// Stop any active voice when entering morning brief page
	useEffect(() => {
		// Stop voice handler on mount to avoid conflicts with brief audio
		stopMiraVoice();
		setIsConversationActive(false);
		setIsListening(false);
		setIsMuted(false);
		setMiraMute(false);
	}, []);

	// Fetch morning brief data on mount
	useEffect(() => {
		const fetchMorningBrief = async () => {
			try {
				setLoading(true);
				setError(null); // Clear any previous errors
				
				// Get token - try to refresh if expired, but also try using existing token
				const { getStoredToken } = await import("@/utils/auth");
				let token = await getValidToken();
				
				// If getValidToken fails, try using stored token anyway (backend will validate)
				if (!token) {
					token = getStoredToken();
				}
				
				if (!token) {
					setError("Not authenticated. Please log in again.");
					setLoading(false);
					return;
				}

				const apiBase = (
					process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
				).replace(/\/+$/, "");

				const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
				let response = await fetch(
					`${apiBase}/morning-brief?timezone=${encodeURIComponent(timezone)}`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
					}
				);

				// If 401, try refreshing token and retry
				if (response.status === 401) {
					const refreshedToken = await getValidToken();
					if (refreshedToken && refreshedToken !== token) {
						// Retry with new token
						response = await fetch(
							`${apiBase}/morning-brief?timezone=${encodeURIComponent(timezone)}`,
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${refreshedToken}`,
									"Content-Type": "application/json",
								},
							}
						);
					}
					
					// If still 401 after refresh attempt, redirect to login
					if (response.status === 401) {
						setError("Your session has expired. Redirecting to login...");
						setTimeout(() => {
							router.push("/login");
						}, 2000);
						setLoading(false);
						return;
					}
				}

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
					throw new Error(errorData.detail || `HTTP ${response.status}`);
				}

				const data = await response.json();
				setBriefData(data);
				setError(null);
				
				// Play audio if available (check for base64 or URL)
				if (data.audio_base64 || data.audio_url) {
					// Stop any active voice conversation to avoid conflicts (safe to call even if not active)
					stopMiraVoice();
					setIsConversationActive(false);
					setIsListening(false);
					
					// Small delay to ensure audio element is rendered
					setTimeout(() => {
						if (audioRef.current) {
							// Ensure voice is stopped before playing brief audio
							stopMiraVoice();
							setIsConversationActive(false);
							setIsListening(false);
							
							// Prefer base64 audio (works in Lambda)
							if (data.audio_base64) {
								try {
									const audioBinary = atob(data.audio_base64);
									const arrayBuffer = new ArrayBuffer(audioBinary.length);
									const view = new Uint8Array(arrayBuffer);
									for (let i = 0; i < audioBinary.length; i++) {
										view[i] = audioBinary.charCodeAt(i);
									}
									const blob = new Blob([view], { type: "audio/mpeg" });
									const url = URL.createObjectURL(blob);
									audioRef.current.src = url;
									
									// Clean up URL when done
									audioRef.current.addEventListener("ended", () => {
										URL.revokeObjectURL(url);
									}, { once: true });
								} catch (err) {
									console.error("Error decoding base64 audio:", err);
									return;
								}
							} else if (data.audio_url) {
								// Fallback to URL
								const apiBaseUrl = (
									process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
								).replace(/\/+$/, "");
								const fullAudioUrl = `${apiBaseUrl}${data.audio_url}`;
								audioRef.current.src = fullAudioUrl;
							} else {
								return;
							}
							
							// Try to play automatically - navigation click counts as user interaction
							// This should work since user clicked to navigate to this page
							const playPromise = audioRef.current.play();
							if (playPromise !== undefined) {
								playPromise
									.then(() => {
										console.log("✅ Morning brief audio playing automatically");
									})
									.catch((err) => {
										// Autoplay blocked - play button will be shown (it's already in the UI)
										console.log("⚠️ Autoplay blocked - user can click 'Play Morning Brief' button:", err);
									});
							}
							
							// Stop voice handler while brief audio is playing (one-time listener)
							const handlePlay = () => {
								stopMiraVoice();
								setIsConversationActive(false);
								setIsListening(false);
								audioRef.current?.removeEventListener("play", handlePlay);
							};
							audioRef.current.addEventListener("play", handlePlay, { once: true });
						}
					}, 100);
				}
			} catch (err) {
				console.error("Error fetching morning brief:", err);
				setError(
					err instanceof Error ? err.message : "Failed to load morning brief"
				);
			} finally {
				setLoading(false);
			}
		};

		fetchMorningBrief();
	}, [router]);

	// Auto-advance from thinking stage after loading completes
	useEffect(() => {
		if (stage === "thinking" && !loading && briefData) {
			const timer = setTimeout(() => {
				setStage("recommendation");
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [stage, loading, briefData]);

	// 🎙 Voice is not auto-started on morning brief page
	// User can manually start it via the mic button
	useEffect(() => {
		// Ensure voice is stopped when leaving the page
		return () => {
			if (isConversationActive) {
				stopMiraVoice();
			}
		};
	}, [isConversationActive]);

	// Listen for calendar modify intents from voice handler
	useEffect(() => {
		interface CalendarModifyEventDetail {
			needsDetails?: boolean;
			event_query?: string | null;
			action?: string | null;
			new_time?: string | null;
		}

		const handler = (e: Event) => {
			const customEvent = e as CustomEvent<CalendarModifyEventDetail>;
			const detail = customEvent?.detail || {};
			const eventName = detail.event_query as string | null;
			const action = detail.action as string | null;
			const newTime = detail.new_time as string | undefined;
			if (action && eventName) {
				handleCalendarModify(eventName, action, newTime);
			} else {
				console.log("Calendar modify needs more details", detail);
			}
		};
		if (typeof window !== "undefined") {
			window.addEventListener("miraCalendarModify", handler as EventListener);
		}
		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("miraCalendarModify", handler as EventListener);
			}
		};
	}, []);

	return (
		<div className="relative flex min-h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden">
			{/* Sidebar */}
			<aside
				className="fixed left-0 top-0 h-full w-[70px] bg-white
				flex-col items-center py-8 gap-8 border-r border-gray-100 
				shadow-[2px_0_10px_rgba(0,0,0,0.03)] hidden md:flex"
			>
				<div className="w-5 h-5 rounded-full bg-gradient-to-b from-[#F9C8E4] to-[#B5A6F7]" />
				{["Dashboard", "Settings"].map((icon) => (
					<button
						key={icon}
						className="p-2 rounded-xl hover:bg-[#F6F0FF] transition"
					>
						<Image
							src={`/Icons/Property 1=${icon}.svg`}
							alt={icon}
							width={20}
							height={20}
						/>
					</button>
				))}
				<button className="mt-auto mb-6 p-2 rounded-xl hover:bg-[#F6F0FF] transition">
					<Image
						src="/Icons/Property 1=Reminder.svg"
						alt="Reminder"
						width={20}
						height={20}
					/>
				</button>
			</aside>

			{/* Main */}
			<main
				className="flex-1 flex flex-col items-center justify-center relative
				px-4 sm:px-6 md:px-10 lg:px-16"
			>
				{/* Top Bar */}
				<div
					className="absolute top-6 left-[90px] md:left-24 flex flex-wrap items-center 
					gap-2 sm:gap-3 text-xs sm:text-sm"
				>
					<span className="font-medium text-gray-800 whitespace-nowrap">
						Wed, Oct 15
					</span>

					<div
						className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 
					rounded-full bg-white/40 backdrop-blur-sm text-xs sm:text-sm"
					>
						<Image
							src="/Icons/Property 1=Location.svg"
							alt="Location"
							width={14}
							height={14}
						/>
						<span className="text-gray-700 font-medium">New York</span>
					</div>

					<div
						className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 
					rounded-full bg-white/40 backdrop-blur-sm text-xs sm:text-sm"
					>
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Weather"
							width={14}
							height={14}
						/>
						<span className="text-gray-700 font-medium">20°</span>
					</div>
				</div>

				{/* Top Right */}
				<div
					className="absolute top-6 right-4 sm:right-6 md:right-10 
					flex flex-wrap justify-center sm:justify-end items-center gap-2 sm:gap-4 text-xs sm:text-sm"
				>
					<button
						className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 
						bg-[#FFF8E7] border border-[#FFE9B5] rounded-full font-medium 
						text-[#B58B00] shadow-sm hover:shadow-md transition"
					>
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Morning Brief"
							width={14}
							height={14}
						/>
						<span>Morning Brief</span>
					</button>

					{/* Mute toggle */}
					{isConversationActive && (
						<button
							onClick={() => {
								const muteState = !isMuted;
								setIsMuted(muteState);
								setMiraMute(muteState);
							}}
							className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 
							bg-[#F5F5F5] border border-gray-200 rounded-full font-medium 
							text-gray-700 shadow-sm hover:shadow-md transition"
						>
							<Image
								src={
									isMuted
										? "/Icons/Property 1=VoiceOff.svg"
										: "/Icons/Property 1=VoiceOn.svg"
								}
								alt={isMuted ? "Muted" : "Unmuted"}
								width={14}
								height={14}
							/>
							<span>{isMuted ? "Muted" : "Mute"}</span>
						</button>
					)}
				</div>

				{/* Orb */}
				<Orb />

				{/* Panel */}
				<div className="w-full flex justify-center mt-10 transition-all duration-700">
					<div
						className="w-[92%] sm:w-[85%] md:w-[80%] lg:w-[720px] 
						transition-all duration-700 ease-in-out"
					>
						{loading && stage === "thinking" && <ThinkingPanel />}
						{error && (
							<div className="bg-white text-sm rounded-2xl border border-red-200 shadow-lg p-6">
								<p className="text-red-600 mb-2">Error loading morning brief</p>
								<p className="text-gray-600 text-sm">{error}</p>
								<button
									onClick={() => window.location.reload()}
									className="mt-4 px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800"
								>
									Retry
								</button>
							</div>
						)}
						{!loading && !error && briefData && (
							<>
								{/* Play Audio Button */}
								{(briefData.audio_base64 || briefData.audio_url) && (
									<div className="mb-4 flex justify-center">
										<button
											onClick={playAudio}
											className="px-6 py-3 bg-[#6245A7] text-white rounded-full font-medium hover:bg-[#7C5BEF] transition flex items-center gap-2"
										>
											<Image
												src="/Icons/Property 1=VoiceOn.svg"
												alt="Play"
												width={20}
												height={20}
											/>
											<span>Play Morning Brief</span>
										</button>
									</div>
								)}
								{stage === "recommendation" && (
									<RecommendationPanel
										briefText={briefData.text}
										onAccept={() => setStage("confirmation")}
									/>
								)}
								{stage === "confirmation" && (
									<ConfirmationPanel briefText={briefData.text} />
								)}
							</>
						)}
					</div>
				</div>

				{/* Hidden audio element for playing the brief */}
				<audio
					ref={audioRef}
					autoPlay={false}
					controls={false}
					style={{ display: "none" }}
				/>

				{/* Mic & Keyboard Toggle */}
				<div className="mt-10 sm:mt-12 flex items-center justify-center">
					<div
						className="relative w-[130px] sm:w-[150px] h-[36px] 
						border border-[#000] bg-white rounded-full px-[6px] 
						shadow-[0_1px_4px_rgba(0,0,0,0.08)] 
						flex items-center justify-between"
					>
						{/* Mic Button */}
						<button
							onClick={() => {
								const newState = !isListening;
								setIsListening(newState);
								if (newState) {
									// Only start voice when user explicitly clicks mic
									setIsConversationActive(true);
									startMiraVoice();
								} else {
									setIsConversationActive(false);
									stopMiraVoice();
									setIsMuted(false);
									setMiraMute(false);
								}
							}}
							className={`flex items-center justify-center w-[60px] h-[28px] rounded-full border border-gray-200 transition-all duration-300 ${
								isListening
									? "bg-black hover:bg-gray-800"
									: "bg-white hover:bg-gray-50"
							}`}
						>
							<Image
								src={
									isListening
										? "/Icons/Property 1=Mic.svg"
										: "/Icons/Property 1=MicOff.svg"
								}
								alt={isListening ? "Mic On" : "Mic Off"}
								width={16}
								height={16}
								className={`transition-all duration-300 ${
									isListening ? "invert" : "brightness-0"
								}`}
							/>
						</button>

						{/* Keyboard Button */}
						<button
							onClick={() => {
								setIsListening(false);
								setIsConversationActive(false);
								stopMiraVoice();
								setIsMuted(false);
								setMiraMute(false);
							}}
							className={`flex items-center justify-center w-[60px] h-[28px] rounded-full border border-gray-200 transition-all duration-300 ${
								!isListening
									? "bg-black hover:bg-gray-800"
									: "bg-white hover:bg-gray-50"
							}`}
						>
							<Image
								src="/Icons/Property 1=Keyboard.svg"
								alt="Keyboard Icon"
								width={16}
								height={16}
								className={`transition-all duration-300 ${
									!isListening ? "invert" : "brightness-0"
								}`}
							/>
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
