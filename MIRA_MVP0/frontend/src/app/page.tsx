/** @format */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import {
	EmailCalendarOverlay,
	type VoiceSummaryCalendarEvent,
	type VoiceSummaryEmail,
	type VoiceSummaryStep,
} from "@/components/voice/EmailCalendarOverlay";
import { extractTokenFromUrl, storeAuthToken } from "@/utils/auth";
import {
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
} from "@/utils/voice/voiceHandler";
import { getWeather } from "@/utils/weather";
import HeaderBar from "@/components/HeaderBar";
import Sidebar from "@/components/Sidebar";

const DEFAULT_SUMMARY_STEPS = [
	{ id: "emails", label: "Checking your inbox for priority emails..." },
	{ id: "events", label: "Reviewing today’s calendar events..." },
	{ id: "highlights", label: "Highlighting the most important meetings..." },
	{ id: "conflicts", label: "Noting any schedule conflicts..." },
];

type VoiceSummaryEventDetail = {
	steps?: { id: string; label: string }[];
	emails?: VoiceSummaryEmail[];
	calendarEvents?: VoiceSummaryCalendarEvent[];
	focus?: string | null;
};

const prepareVoiceSteps = (
	rawSteps: { id: string; label: string }[]
): VoiceSummaryStep[] => {
	if (!rawSteps.length) {
		return [];
	}

	return rawSteps.map((step, index, arr) => {
		if (index === 0) {
			return { ...step, status: "active" as const };
		}
		if (index === arr.length - 1) {
			return { ...step, status: "disabled" as const };
		}
		return { ...step, status: "pending" as const };
	});
};

export default function Home() {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [isListening, setIsListening] = useState(true);
	const [greeting, setGreeting] = useState<string>("");
	// Removed unused isMicOn state
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [isTextMode, setIsTextMode] = useState(false);
	const [textMessages, setTextMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);
	const [isLoadingResponse, setIsLoadingResponse] = useState(false);

	// Added: dynamic location state (defaults to "New York")
	const [location, setLocation] = useState<string>("New York");
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);

	// Timezone for formatting the date/time for the detected location.
	// Default to the browser/system timezone — good offline/frontend-only fallback.
	const [timezone, setTimezone] = useState<string>(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
	);

	// Weather state: store coords and current temperature. We'll call Open-Meteo (no API key)
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

	const greetingCalledRef = useRef(false);
	const [summaryOverlayVisible, setSummaryOverlayVisible] = useState(false);
	const [summarySteps, setSummarySteps] = useState<VoiceSummaryStep[]>(() =>
		prepareVoiceSteps(DEFAULT_SUMMARY_STEPS)
	);
	const [summaryStage, setSummaryStage] = useState<"thinking" | "summary">(
		"thinking"
	);
	const [summaryEmails, setSummaryEmails] = useState<VoiceSummaryEmail[]>([]);
	const [summaryEvents, setSummaryEvents] = useState<
		VoiceSummaryCalendarEvent[]
	>([]);
	const [summaryFocus, setSummaryFocus] = useState<string | null>(null);
	const [summaryRunId, setSummaryRunId] = useState(0);
	const [pendingSummaryMessage, setPendingSummaryMessage] = useState<
		string | null
	>(null);

	// Added: get system/geolocation and reverse-geocode to a readable place name
	useEffect(() => {
		// Helper: IP-based fallback when geolocation is unavailable or denied
		const ipFallback = async () => {
			try {
				const res = await fetch("https://ipapi.co/json/");
				if (!res.ok) return;
				const data = await res.json();
				const city =
					data.city || data.region || data.region_code || data.country_name;
				// ipapi returns a `timezone` field like 'America/New_York'
				if (data.timezone) setTimezone(data.timezone);
				if (city) setLocation(city);
				// ipapi provides approximate lat/lon which we can use for weather lookup
				if (data.latitude && data.longitude) {
					setLatitude(Number(data.latitude));
					setLongitude(Number(data.longitude));
				}
			} catch (err) {
				console.error("IP geolocation fallback error:", err);
			} finally {
				setIsLocationLoading(false);
			}
		};

		if (!("geolocation" in navigator)) {
			// Browser doesn't support navigator.geolocation — try IP fallback
			ipFallback();
			return;
		}

		const success = async (pos: GeolocationPosition) => {
			try {
				const { latitude, longitude } = pos.coords;
				// Use OpenStreetMap Nominatim reverse geocoding (no key required)
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
				);
				if (!res.ok) {
					// If reverse geocoding fails, fall back to IP-based lookup
					await ipFallback();
					return;
				}
				const data = await res.json();
				const city =
					data?.address?.city ||
					data?.address?.town ||
					data?.address?.village ||
					data?.address?.state ||
					data?.address?.county;
				if (city) setLocation(city);

				// If possible, keep the browser's timezone (Intl); this will usually
				// match the geolocation. If you need absolute timezone-from-coords,
				// you'd need a timezone lookup service or library (server or heavy client bundle).
				setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

				// Save coordinates for weather lookup
				setLatitude(latitude);
				setLongitude(longitude);

				// Fetch weather for these coords (via backend proxy)
				fetchWeatherForCoords(latitude, longitude).catch((e) =>
					console.error("Weather fetch failed:", e)
				);
			} catch (err) {
				console.error("reverse geocode error:", err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const error = async (err: GeolocationPositionError) => {
			console.error("geolocation error:", err);
			// On permission denied or other errors, try IP-based lookup
			await ipFallback();
		};

		navigator.geolocation.getCurrentPosition(success, error, {
			timeout: 10000,
		});
	}, []);

	const handleMuteToggle = () => {
		const muteState = !isMuted;
		setIsMuted(muteState);
		setMiraMute(muteState);
	};
	// Removed unused handleMicToggle

	useEffect(() => {
		console.log("Initializing Mira...");
		startMiraVoice();
		setIsConversationActive(true);
	}, []);

	useEffect(() => {
		const init = async () => {
			const urlToken = extractTokenFromUrl();
			if (urlToken) {
				storeAuthToken(urlToken);
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);
				window.location.reload();
				return;
			}

			// Try to refresh token if expired (for returning users)
			const { getValidToken } = await import("@/utils/auth");
			const validToken = await getValidToken();

			if (!validToken) {
				// No valid token, redirect to login
				router.push("/login");
				return;
			}

			try {
				const apiBase = (
					process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
				).replace(/\/+$/, "");
				const email = localStorage.getItem("mira_email");

				if (email) {
					const onboardingRes = await fetch(
						`${apiBase}/onboarding_status?email=${encodeURIComponent(email)}`,
						{
							headers: {
								Authorization: `Bearer ${validToken}`,
								"Content-Type": "application/json",
							},
						}
					);

					if (onboardingRes.ok) {
						const onboardingData = await onboardingRes.json();
						const onboarded = !!onboardingData?.onboarded;
						if (!onboarded) {
							router.push("/onboarding/step1");
							return;
						}
					}
				}
			} catch (error) {
				console.log("Error checking onboarding status on home page:", error);
			}

			if (greetingCalledRef.current) return;
			greetingCalledRef.current = true;

			// Get user name from localStorage (updated when profile is saved)
			// The name is kept in sync via profile_update endpoint and localStorage
			setTimeout(() => {
				const userName =
					localStorage.getItem("mira_full_name") ||
					localStorage.getItem("mira_username") ||
					localStorage.getItem("user_name") ||
					"there";

				const hour = new Date().getHours();
				let timeGreeting = "Good Evening";
				if (hour < 12) timeGreeting = "Good Morning";
				else if (hour < 18) timeGreeting = "Good Afternoon";

				// Extract first name for personalized greeting
				const firstName =
					userName !== "there" ? userName.split(" ")[0] : userName;
				setGreeting(`${timeGreeting}, ${firstName}!`);
				// playVoice(`${timeGreeting}, ${firstName}!`); // Temporarily disabled
				console.info(
					"Greeting voice is temporarily disabled. Fallback greeting:",
					`${timeGreeting}, ${firstName}!`
				);
			}, 300);
		};
		init();
	}, [router]);

	// Listen for user data updates to refresh greeting
	useEffect(() => {
		const handleUserDataUpdate = () => {
			// Update greeting when user data changes (e.g., profile update)
			const userName =
				localStorage.getItem("mira_full_name") ||
				localStorage.getItem("mira_username") ||
				localStorage.getItem("user_name") ||
				"there";

			const hour = new Date().getHours();
			let timeGreeting = "Good Evening";
			if (hour < 12) timeGreeting = "Good Morning";
			else if (hour < 18) timeGreeting = "Good Afternoon";

			const firstName =
				userName !== "there" ? userName.split(" ")[0] : userName;
			setGreeting(`${timeGreeting}, ${firstName}!`);
		};

		window.addEventListener("userDataUpdated", handleUserDataUpdate);

		return () => {
			window.removeEventListener("userDataUpdated", handleUserDataUpdate);
		};
	}, []);

	useEffect(() => {
		const handler = async (event: Event) => {
			const customEvent = event as CustomEvent<VoiceSummaryEventDetail>;
			const detail = customEvent.detail || {};
			const rawSteps = detail.steps?.length
				? detail.steps
				: DEFAULT_SUMMARY_STEPS;

			// The backend now provides both Gmail + Outlook emails and Google + Outlook Calendar events
			// in the detail.calendarEvents array, so we can use it directly
			const normalizedCalendarEvents: VoiceSummaryCalendarEvent[] =
				Array.isArray(detail.calendarEvents) ? detail.calendarEvents : [];

			setSummarySteps(prepareVoiceSteps(rawSteps));
			setSummaryEmails(detail.emails ?? []);
			setSummaryEvents(normalizedCalendarEvents);
			setSummaryFocus(detail.focus ?? null);
			setSummaryStage("thinking");
			setSummaryOverlayVisible(true);
			setSummaryRunId((id) => id + 1);
		};

		if (typeof window !== "undefined") {
			window.addEventListener(
				"miraEmailCalendarSummary",
				handler as EventListener
			);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"miraEmailCalendarSummary",
					handler as EventListener
				);
			}
		};
	}, []); // No dependencies needed since we're just using the event detail directly

	useEffect(() => {
		if (!summaryOverlayVisible || !summarySteps.length) return;

		const total = summarySteps.length;
		const STEP_DURATION = 1200;
		const timers: NodeJS.Timeout[] = [];

		for (let i = 0; i < total; i++) {
			timers.push(
				setTimeout(() => {
					setSummarySteps((prev) =>
						prev.map((step, idx) => {
							if (idx < i) {
								return { ...step, status: "done" as const };
							}
							if (idx === i) {
								return { ...step, status: "done" as const };
							}
							if (idx === i + 1) {
								return { ...step, status: "active" as const };
							}
							return step;
						})
					);

					if (i === total - 1) {
						setSummaryStage("summary");
					}
				}, (i + 1) * STEP_DURATION)
			);
		}

		return () => {
			timers.forEach(clearTimeout);
		};
	}, [summaryOverlayVisible, summaryRunId, summarySteps.length]);

	useEffect(() => {
		if (summaryStage === "summary" && pendingSummaryMessage) {
			setTextMessages((prev) => [
				...prev,
				{ role: "assistant", content: pendingSummaryMessage },
			]);
			setPendingSummaryMessage(null);
		}
	}, [summaryStage, pendingSummaryMessage]);

	// Format a friendly date string for the provided timezone.
	const getFormattedDate = (tz: string) => {
		try {
			const now = new Date();
			return new Intl.DateTimeFormat("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
				timeZone: tz,
			}).format(now);
		} catch {
			// Fallback to local formatting if Intl fails for some reason
			return new Date().toLocaleDateString(undefined, {
				weekday: "short",
				month: "short",
				day: "numeric",
			});
		}
	};

	// Fetch current weather using Open-Meteo API directly
	const fetchWeatherForCoords = async (lat: number, lon: number) => {
		try {
			setIsWeatherLoading(true);
			console.log("Fetching weather for coords:", lat, lon);
			const data = await getWeather(lat, lon);
			const temp = data?.temperatureC;
			if (typeof temp === "number") setTemperatureC(temp);
		} catch (err) {
			console.error("Error fetching weather:", err);
		} finally {
			setIsWeatherLoading(false);
		}
	};

	// When coords change, fetch weather
	useEffect(() => {
		if (latitude != null && longitude != null) {
			fetchWeatherForCoords(latitude, longitude).catch((e) => console.error(e));
		}
	}, [latitude, longitude]);

	// Handle text input submission
	const handleTextSubmit = async (text?: string) => {
		const queryText = text || input.trim();
		if (!queryText) return;

		// Add user message to conversation
		setTextMessages((prev) => [...prev, { role: "user", content: queryText }]);
		setInput("");
		setIsLoadingResponse(true);

		try {
			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");
			const { getValidToken } = await import("@/utils/auth");
			const token = await getValidToken();

			const response = await fetch(`${apiBase}/api/text-query`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: "include", // ✅ Include cookies (needed for Outlook ms_access_token)
				body: JSON.stringify({
					query: queryText,
					history: textMessages,
					token, // ✅ include token in body for backend
				}),
			});

			// ✅ log backend response status and any text before throwing
			if (!response.ok) {
				const errorText = await response.text();
				console.error("❌ Backend returned error:", response.status, errorText);
				throw new Error(`Backend returned ${response.status}: ${errorText}`);
			}

			let data;
			try {
				data = await response.json();
			} catch (err) {
				console.error("❌ Failed to parse JSON from backend:", err);
				throw new Error("Invalid JSON in backend response");
			}

			// ✅ Handle navigation actions
			if (data.action === "navigate" && data.actionTarget) {
				setTimeout(() => router.push(data.actionTarget), 500);
				setTextMessages((prev) => [
					...prev,
					{ role: "assistant", content: data.text || "Navigating..." },
				]);
				return;
			}

			// ✅ Handle calendar/email summary
			if (data.action === "email_calendar_summary") {
				if (data.text) setPendingSummaryMessage(data.text);
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraEmailCalendarSummary", {
							detail: data.actionData ?? {},
						})
					);
				}
				return;
			}

			// ✅ Default case — add assistant text reply
			if (data.text) {
				setTextMessages((prev) => [
					...prev,
					{ role: "assistant", content: data.text },
				]);
			} else {
				console.warn("⚠️ No text returned from backend:", data);
			}
		} catch (error) {
			console.error("🚨 Error sending text query:", error);
			setTextMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: "Sorry, I encountered an error processing your request.",
				},
			]);
		} finally {
			setIsLoadingResponse(false);
		}
	};

	return (
		<div className="flex flex-col min-h-screen bg-[#F8F8FB] text-gray-800">
			{/* Global Header Bar */}
			<div className="absolute top-6 left-0 w-full pl-[70px] md:pl-[90px]">
				<HeaderBar
					dateLabel={new Date().toLocaleDateString("en-US", {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}
					locationLabel={location}
					temperatureLabel={temperatureC != null ? `${temperatureC}°` : "—"}
					isLocationLoading={isLocationLoading}
					isWeatherLoading={isWeatherLoading}
				/>
			</div>
			<main className="flex-1 flex flex-col items-center px-2 sm:px-4 md:px-6 pt-20 pb-20">
				{/* SCALE CONTAINER */}
				<div className="scale-[0.9] flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
					{/* Orb + Greeting */}
					<div className="relative flex flex-col items-center mt-9 sm:mt-20">
						<div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5] shadow-[0_0_80px_15px_rgba(210,180,255,0.45)] animate-pulse"></div>
						<p className="w-full max-w-[368px] h-[50px] opacity-100 text-[rgba(70,70,71,1)] font-['Outfit'] font-medium text-lg sm:text-2xl md:text-3xl lg:text-[40px] leading-[100%] tracking-[0.5%] mt-6 sm:mt-8 text-center whitespace-nowrap flex items-center justify-center">
							{greeting}
						</p>
					</div>

					{/* Conversation Feed for Text Mode */}
					{isTextMode && textMessages.length > 0 && (
						<div className="mt-10 sm:mt-14 w-full max-w-2xl space-y-4 max-h-[400px] overflow-y-auto">
							{textMessages.map((msg, idx) => (
								<div
									key={idx}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
										}`}
								>
									<div
										className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user"
											? "bg-gradient-to-r from-[#d9b8ff] to-[#bfa3ff] text-gray-900"
											: "bg-white border border-gray-200 text-gray-800"
											} shadow-sm`}
									>
										<p className="text-sm leading-relaxed">{msg.content}</p>
									</div>
								</div>
							))}
							{isLoadingResponse && (
								<div className="flex justify-start">
									<div className="max-w-[80%] rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
										<div className="flex items-center gap-2">
											<div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
											<div className="h-2 w-2 animate-pulse rounded-full bg-purple-500 animation-delay-200" />
											<div className="h-2 w-2 animate-pulse rounded-full bg-purple-500 animation-delay-400" />
										</div>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Input Bar — Always Visible */}
					<div className="relative mt-10 sm:mt-14 w-full max-w-[700px] flex flex-col items-center">
						<div className="w-full rounded-[10px] bg-gradient-to-r from-[#F4A4D3] to-[#B5A6F7] p-[1.5px] shadow-[0_12px_35px_rgba(181,166,247,0.45)]">
							<div className="flex items-center rounded-[10px] bg-white px-4 sm:px-5 py-2 sm:py-2.5 w-full">
								<input
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											setIsConversationActive(true);
											handleTextSubmit();
										}
									}}
									placeholder={
										isListening ? "I'm listening..." : "Type your request..."
									}
									className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-transparent text-gray-700 placeholder-gray-400 rounded-l-xl focus:outline-none font-medium text-sm sm:text-base"
									disabled={isLoadingResponse}
								/>
								<button
									type="button"
									onClick={() => {
										setIsConversationActive(true);
										handleTextSubmit();
									}}
									disabled={isLoadingResponse || !input.trim()}
									className="flex items-center justify-center w-9 sm:w-10 h-9 sm:h-10 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Icon name="Send" size={16} />
								</button>
							</div>
						</div>
					</div>

					{/* Example Prompts — Only Visible Before Conversation */}
					{!isConversationActive && textMessages.length === 0 && (
						<div className="w-full max-w-[724px] min-h-[198px] text-left opacity-100 mt-6 sm:mt-8 px-4">
							<p className="w-full max-w-[724px] h-auto min-h-[23px] opacity-100 text-[rgba(40,40,41,1)] font-['Outfit'] font-normal text-base sm:text-[18px] leading-[100%] tracking-[0.5%] mb-3">
								Or start with an example below
							</p>
							<div className="flex flex-wrap gap-2 sm:gap-2.5">
								{[
									"give me my morning brief",
									"How's my day looking?",
									"Summarize today's tasks.",
									"What meetings do I have today?",
									"Show me my emails",
									"Show me my emails and calendar",
									"Show my calender events",
									"Wrap up my day.",
								].map((example, i) => (
									<button
										key={i}
										onClick={() => {
											setIsConversationActive(true); // ✅ hide examples once clicked
											handleTextSubmit(example);
										}}
										disabled={isLoadingResponse}
										className="px-3 sm:px-3.5 py-1 sm:py-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition text-gray-700 text-[12.5px] sm:text-[13.5px] font-normal disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{example}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Email & calendar thinking panel */}
					{summaryOverlayVisible && (
						<div className="mt-10 flex w-full justify-center px-4">
							<EmailCalendarOverlay
								visible={summaryOverlayVisible}
								stage={summaryStage}
								steps={summarySteps}
								emails={summaryEmails}
								calendarEvents={summaryEvents}
								focusNote={summaryFocus}
								isMuted={isMuted}
								onMuteToggle={handleMuteToggle}
								chips={{
									dateLabel: getFormattedDate(timezone),
									locationLabel: isLocationLoading ? "Detecting..." : location,
									temperatureLabel:
										temperatureC != null
											? `${Math.round(temperatureC)}°`
											: isWeatherLoading
												? "..."
												: "—",
								}}
								showContextChips={false}
								showControls={false}
							/>
						</div>
					)}

					{/* Mic & Keyboard Toggle */}
					<div className="mt-10 sm:mt-12 flex items-center justify-center">
						<div className="relative w-[130px] sm:w-[150px] h-[36px] border border-[#000] bg-white rounded-full px-[6px] shadow-[0_1px_4px_rgba(0,0,0,0.08)] flex items-center justify-between">
							{/* Mic Button */}
							<button
								onClick={() => {
									const newState = !isListening;
									setIsListening(newState);
									if (newState) {
										setIsConversationActive(true);
										startMiraVoice();
									} else {
										setIsConversationActive(false);
										stopMiraVoice();
										setIsMuted(false);
										setMiraMute(false);
									}
								}}
								className={`flex items-center justify-center w-[60px] h-[28px] rounded-full border border-gray-200 transition-all duration-300 ${isListening
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
									className={`transition-all duration-300 ${isListening ? "invert" : "brightness-0"
										}`}
								/>
							</button>

							{/* Keyboard Button */}
							<button
								onClick={() => {
									const newTextMode = !isTextMode;
									setIsTextMode(newTextMode);
									if (newTextMode) {
										// Switching to text mode
										setIsListening(false);
										setIsConversationActive(false);
										stopMiraVoice();
										setIsMuted(false);
										setMiraMute(false);
									}
								}}
								className={`flex items-center justify-center w-[60px] h-[28px] rounded-full border border-gray-200 transition-all duration-300 ${isTextMode || !isListening
									? "bg-black hover:bg-gray-800"
									: "bg-white hover:bg-gray-50"
									}`}
							>
								<Image
									src="/Icons/Property 1=Keyboard.svg"
									alt="Keyboard Icon"
									width={16}
									height={16}
									className={`transition-all duration-300 ${isTextMode || !isListening ? "invert" : "brightness-0"
										}`}
								/>
							</button>
						</div>
					</div>
				</div>
				<Sidebar />
			</main>
		</div>
	);
}
