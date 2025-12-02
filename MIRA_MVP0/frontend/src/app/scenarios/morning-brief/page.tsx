/** @format */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { getWeather } from "@/utils/weather";
import HeaderBar from "@/components/HeaderBar";
import Sidebar from "@/components/Sidebar";
import FooterBar from "@/components/FooterBar";
import { detectIntent } from "@/utils/voice/intents";
import { useVoiceNavigation } from "@/utils/voice/navigationHandler";

interface MorningBriefData {
	text: string;
	audio_path?: string;
	audio_url?: string;
	audio_base64?: string;
	user_name: string;
	// Event data
	events?: {
		id: string;
		title: string;
		timeRange: string;
		provider?: string;
	}[];
	total_events?: number;
	total_teams?: number;
	next_event?: {
		summary: string;
		start: string;
		duration: number;
	};
	// Email data
	email_important?: number;
	gmail_count?: number;
	outlook_count?: number;
	total_unread?: number;
}

export default function MorningBrief() {
	useVoiceNavigation();

	const router = useRouter();
	const [stage, setStage] = useState<
		"thinking" | "recommendation" | "confirmation"
	>("thinking");

	const [isListening, setIsListening] = useState(true);
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [isTextMode, setIsTextMode] = useState(false);

	const [isMuted, setIsMuted] = useState(false);
	const [briefData, setBriefData] = useState<MorningBriefData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// 🌤 Weather + Location
	const [location, setLocation] = useState<string>("Detecting...");
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
	const [weatherCode, setWeatherCode] = useState<number | null>(null);
	const [weatherDescription, setWeatherDescription] = useState<string | null>(
		null
	);
	const [timezone, setTimezone] = useState<string>(
		Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
	);

	// TEXT MODE STATES

	const [input, setInput] = useState("");
	const [textMessages, setTextMessages] = useState<
		{ role: "user" | "assistant"; content: string }[]
	>([]);

	const [isLoadingResponse, setIsLoadingResponse] = useState(false);

	const handleTextSubmit = () => {
		if (!input.trim()) return;

		setIsLoadingResponse(true);

		// Add user message
		setTextMessages((prev) => [...prev, { role: "user", content: input }]);

		// Clear input
		setInput("");

		// Fake assistant response for now
		setTimeout(() => {
			setTextMessages((prev) => [
				...prev,
				{ role: "assistant", content: "Working on that…" },
			]);
			setIsLoadingResponse(false);
		}, 1200);
	};
	const handleVoiceCommand = (text: string) => {
		const parsed = detectIntent(text.toLowerCase());

		switch (parsed.intent) {
			case "SHOW_CALENDAR":
				router.push("/scenarios/smart-summary");
				return;

			case "SHOW_EMAILS":
				router.push("/scenarios/smart-summary?focus=emails");
				return;

			case "SHOW_EMAILS_AND_CALENDAR":
				router.push("/scenarios/smart-summary");
				return;

			case "SHOW_MORNING_BRIEF":
				router.push("/scenarios/morning-brief");
				return;

			case "GO_TO_DASHBOARD":
				router.push("/dashboard");
				return;

			case "GO_HOME":
				router.push("/");
				return;
		}
	};
	useEffect(() => {
		const listener = (e: any) => {
			const transcript = e.detail?.text;
			if (!transcript) return;
			handleVoiceCommand(transcript);
		};

		window.addEventListener("miraTranscriptFinal", listener);
		return () => window.removeEventListener("miraTranscriptFinal", listener);
	}, []);

	const parsed = detectIntent(input?.trim() || "");

	switch (parsed.intent) {
		case "SHOW_CALENDAR":
			router.push("/scenarios/smart-summary");
			return;

		case "SHOW_EMAILS":
			router.push("/scenarios/smart-summary?focus=emails");
			return;

		case "SHOW_EMAILS_AND_CALENDAR":
			router.push("/scenarios/smart-summary");
			return;

		case "SHOW_MORNING_BRIEF":
			router.push("/scenarios/morning-brief");
			return;

		case "GO_TO_DASHBOARD":
			router.push("/dashboard");
			return;

		case "GO_HOME":
			router.push("/");
			return;
	}

	const speakMorningBrief = (text: string) => {
		if (!text) return;
		window.dispatchEvent(new CustomEvent("miraSpeak", { detail: { text } }));
	};

	useEffect(() => {
		const handler = (e: Event) => {
			const customEvent = e as CustomEvent<{ text: string }>;
			console.log("🔥 miraSpeak event RECEIVED in page:", customEvent.detail);
		};
		window.addEventListener("miraSpeak", handler);
		return () => window.removeEventListener("miraSpeak", handler);
	}, []);

	useEffect(() => {
		const ipFallback = async () => {
			try {
				const res = await fetch("https://ipapi.co/json/");
				const data = await res.json();

				setLocation(data.city || data.region || "Unknown");
				setTimezone(data.timezone || timezone);

				if (data.latitude && data.longitude) {
					setLatitude(Number(data.latitude));
					setLongitude(Number(data.longitude));
				}
			} catch (err) {
				console.error("IP fallback error:", err);
			} finally {
				setIsLocationLoading(false);
			}
		};

		if (!("geolocation" in navigator)) {
			ipFallback();
			return;
		}

		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const { latitude, longitude } = pos.coords;
				setLatitude(latitude);
				setLongitude(longitude);

				try {
					const res = await fetch(
						`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
					);
					const data = await res.json();

					const city =
						data?.address?.city ||
						data?.address?.town ||
						data?.address?.village ||
						data?.address?.state ||
						data?.address?.county ||
						"Unknown";

					setLocation(city);
				} catch {
					await ipFallback();
				}

				setIsLocationLoading(false);
			},
			async () => {
				await ipFallback();
			},
			{ timeout: 10000 }
		);
	}, [timezone]);
	const fetchWeatherForCoords = useCallback(
		async (lat: number, lon: number) => {
			// Helper: map Open-Meteo weathercode to simple description
			const openMeteoCodeToDesc = (code: number) => {
				// Simplified mapping for common values
				switch (code) {
					case 0:
						return "Clear";
					case 1:
					case 2:
					case 3:
						return "Partly cloudy";
					case 45:
					case 48:
						return "Fog";
					case 51:
					case 53:
					case 55:
						return "Drizzle";
					case 61:
					case 63:
					case 65:
						return "Rain";
					case 71:
					case 73:
					case 75:
						return "Snow";
					case 80:
					case 81:
					case 82:
						return "Showers";
					case 95:
					case 96:
					case 99:
						return "Thunderstorm";
					default:
						return "Unknown";
				}
			};
			try {
				setIsWeatherLoading(true);
				console.log("Dashboard: fetching weather for coords:", lat, lon);
				const data = await getWeather(lat, lon);
				const temp = data?.temperatureC;
				let desc: string | null = null;
				// Map weathercode from Open-Meteo payload
				if (data?.raw?.current_weather?.weathercode !== undefined) {
					const code = Number(data.raw.current_weather.weathercode);
					setWeatherCode(code);
					desc = openMeteoCodeToDesc(code);
				}

				if (typeof temp === "number") setTemperatureC(temp);
				if (desc) setWeatherDescription(desc);
				if (!desc && temp == null)
					console.warn(
						"Dashboard: weather response had no usable fields",
						data
					);
			} catch (err) {
				console.error("Dashboard: Error fetching weather:", err);
			} finally {
				setIsWeatherLoading(false);
			}
		},
		[]
	);
	useEffect(() => {
		if (latitude != null && longitude != null) {
			fetchWeatherForCoords(latitude, longitude);
		}
	}, [latitude, longitude]);

	const handleMuteToggle = () => {
		const muteState = !isMuted;
		setIsMuted(muteState);
		setMiraMute(muteState);
	};
	// Handle calendar modification from voice commands
	const handleCalendarModify = async (
		eventName: string,
		action: string,
		newTime?: string
	) => {
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
				const errorData = await response
					.json()
					.catch(() => ({ detail: "Unknown error" }));
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
						body: JSON.stringify({
							latitude,
							longitude,
						}),
					}
				);

				// If 401, try refreshing token and retry
				if (response.status === 401) {
					const refreshedToken = await getValidToken();
					if (refreshedToken && refreshedToken !== token) {
						// Retry with new token
						response = await fetch(
							`${apiBase}/morning-brief?timezone=${encodeURIComponent(
								timezone
							)}`,
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
					const errorData = await response
						.json()
						.catch(() => ({ detail: "Unknown error" }));
					throw new Error(errorData.detail || `HTTP ${response.status}`);
				}

				const data = await response.json();
				setBriefData(data);
				setError(null);

				// Play audio if available (check for base64 or URL)
				if (data.audio_base64 || data.audio_url) {
					// Small delay to ensure audio element is rendered
					setTimeout(() => {
						if (audioRef.current) {
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
									audioRef.current.addEventListener(
										"ended",
										() => {
											URL.revokeObjectURL(url);
										},
										{ once: true }
									);
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
										console.log(
											"⚠️ Autoplay blocked - user can click 'Play Morning Brief' button:",
											err
										);
									});
							}

							// Stop voice handler while brief audio is playing (one-time listener)
							const handlePlay = () => {
								stopMiraVoice();

								audioRef.current?.removeEventListener("play", handlePlay);
							};
							audioRef.current.addEventListener("play", handlePlay, {
								once: true,
							});
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

	// Speak morning brief when data is loaded and conditions are met
	useEffect(() => {
		if (!isMuted && isListening && briefData?.text) {
			speakMorningBrief(briefData.text);
		}
	}, [briefData, isListening, isMuted]);

	// Auto-advance from thinking stage after loading completes
	// Auto-advance immediately after loading completes
	useEffect(() => {
		if (!loading && briefData) {
			setStage("recommendation");
		}
	}, [loading, briefData]);

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
				window.removeEventListener(
					"miraCalendarModify",
					handler as EventListener
				);
			}
		};
	}, []);

	return (
		<div className="flex flex-col min-h-screen bg-[#F8F8FB] text-gray-800">
			{/* Global Header Bar */}
			<div className="fixed top-0 left-0 w-full bg-[#F8F8FB] pl-[70px] md:pl-[90px]">
				<HeaderBar
					dateLabel={new Date().toLocaleDateString("en-US", {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}
					locationLabel={location}
					temperatureLabel={
						temperatureC != null ? `${Math.floor(temperatureC)}°` : "--"
					}
					weatherCode={weatherCode}
					isLocationLoading={isLocationLoading}
					isWeatherLoading={isWeatherLoading}
					scenarioTag="morning-brief"
				/>
			</div>

			{/* Main */}
			<main className="max-sm:mt-6 flex-1 flex flex-col items-center px-2 sm:px-4 md:px-6">
				{/* SCALE CONTAINER */}
				<div className="scale-[0.85] flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
					<audio
						ref={audioRef}
						autoPlay={false}
						controls={false}
						style={{ display: "none" }}
					/>

					{/* ORB (must NOT be fixed) */}
					<div className="mt-4 relative flex flex-col items-center">
						<div
							className="w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br 
        from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5]
        shadow-[0_0_80px_15px_rgba(210,180,255,0.45)] animate-pulse"
						></div>
					</div>
					{/* PANEL exactly like conversation feed */}
					<div className="w-full flex justify-center">
						<div className="w-full max-w-[800px] mx-auto">
							{loading && stage === "thinking" && (
								<div className="max-w-[800px] bg-[#F8F8FB] rounded-xl">
									<ThinkingPanel />
								</div>
							)}

							{!loading && !error && briefData && (
								<>
									{stage === "recommendation" && (
										<div className="relative mt-14 w-full max-w-[800px]">
											{/* SCROLLABLE CONTENT */}
											<div
												className="max-h-[58vh] overflow-y-scroll no-scrollbar bg-white border border-gray-200 rounded-[25px] relative z-10 w-full"
												onScroll={(e) => {
													const frame = document.querySelector(
														".scroll-frame"
													) as HTMLElement;
													if (!frame) return;

													if (e.currentTarget.scrollTop > 2) {
														frame.style.opacity = "1";
													} else {
														frame.style.opacity = "0";
													}
												}}
											>
												<RecommendationPanel
													briefText={briefData.text}
													temperatureC={temperatureC}
													isWeatherLoading={isWeatherLoading}
													onAccept={() => setStage("confirmation")}
													events={briefData.events}
													totalEvents={briefData.total_events}
													totalTeams={briefData.total_teams}
													nextEvent={briefData.next_event}
													emailImportant={briefData.email_important}
													gmailCount={briefData.gmail_count}
													outlookCount={briefData.outlook_count}
													totalUnread={briefData.total_unread}
												/>
											</div>
										</div>
									)}

									{stage === "confirmation" && (
										<ConfirmationPanel briefText={briefData.text} />
									)}
								</>
							)}
						</div>
					</div>
				</div>
			</main>
			<Sidebar />
			{/* FooterBar only AFTER conversation starts */}
			<div className="fixed bottom-4 left-0 w-full flex justify-center z-50">
				<FooterBar
					alwaysShowInput={true}
					isListening={isListening}
					isTextMode={isTextMode}
					setIsListening={setIsListening}
					setIsTextMode={setIsTextMode}
					setIsConversationActive={setIsConversationActive}
					setIsMuted={setIsMuted}
					startMiraVoice={startMiraVoice}
					stopMiraVoice={stopMiraVoice}
					setMiraMute={setMiraMute}
					input={input}
					setInput={setInput}
					handleTextSubmit={handleTextSubmit}
					isLoadingResponse={isLoadingResponse}
					textMessages={textMessages}
				/>
			</div>
		</div>
	);
}
