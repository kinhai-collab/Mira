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
import FooterBar from "@/components/FooterBar";
import Orb from "@/components/Orb";

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
	const [weatherCode, setWeatherCode] = useState<number | null>(null);
	const [weatherDescription, setWeatherDescription] = useState<string | null>(
		null
	);

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
	const [isMovingDown, setIsMovingDown] = useState(false);

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
	// When coords change, fetch weather
	useEffect(() => {
		if (latitude != null && longitude != null) {
			fetchWeatherForCoords(latitude, longitude).catch((e) => console.error(e));
		}
	}, [latitude, longitude]);
	const animateThenSubmit = (text?: string) => {
		// Only trigger animation the FIRST time
		if (textMessages.length === 0) {
			setIsMovingDown(true);

			setTimeout(() => {
				handleTextSubmit(text);
			}, 500); // match animation duration
		} else {
			handleTextSubmit(text);
		}
	};

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

			// Auto-detect timezone from browser
			const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
					timezone: detectedTimezone, // 🌍 Auto-detect and send timezone
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

			// ✅ Handle calendar actions (schedule, cancel, reschedule)
			if (data.action && data.action.startsWith("calendar_")) {
				// Display the response text from Mira
				if (data.text) {
					setTextMessages((prev) => [
						...prev,
						{ role: "assistant", content: data.text },
					]);
				}
				// Log the action result for debugging
				if (data.actionResult) {
					console.log(
						"Calendar action completed:",
						data.action,
						data.actionResult
					);
				}
				// ✅ Dispatch event to refresh dashboard and calendar page
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraCalendarUpdated", {
							detail: {
								action: data.action,
								result: data.actionResult,
							},
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
			/>
			<main className="flex-1 flex flex-col items-center px-2 sm:px-4 md:px-6">
				{/* SCALE CONTAINER */}
				<div className="scale-[0.85] flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
					{/* Orb + Greeting */}
					<div className="orb-wrapper mt-9 max-sm:mt-8">
						<Orb hasMessages={textMessages.length > 0} />
					</div>

					{textMessages.length === 0 && (
						<p className="w-full max-w-[368px] h-[50px] opacity-100 text-[rgba(70,70,71,1)] font-['Outfit'] font-medium text-lg sm:text-2xl md:text-3xl lg:text-[40px] leading-[100%] tracking-[0.5%] mt-6 sm:mt-8 text-center whitespace-nowrap flex items-center justify-center">
							{greeting}
						</p>
					)}
					{/* CENTER TEXT BAR — before conversation */}
					{(textMessages.length === 0 || isMovingDown) && (
						<div
							className={`
            w-full max-w-[720px] mt-6 mb-4
            transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]
            ${
							isMovingDown
								? "translate-y-[350px] opacity-0"
								: "translate-y-0 opacity-100"
						}
        `}
						>
							<div className="rounded-[10px] bg-gradient-to-r from-[#F4A4D3] to-[#B5A6F7] p-[1.5px] shadow-[0_12px_35px_rgba(181,166,247,0.45)]">
								<div className="flex items-center rounded-[10px] bg-white px-4 py-2">
									<input
										type="text"
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												setIsConversationActive(true);
												animateThenSubmit();
											}
										}}
										placeholder={
											isListening ? "I'm listening..." : "Type your request..."
										}
										className="flex-1 px-3 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none text-sm"
									/>
									<button
										onClick={() => {
											setIsConversationActive(true);
											animateThenSubmit();
										}}
										disabled={!input.trim()}
										className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm disabled:opacity-50"
									>
										<Icon name="Send" size={16} />
									</button>
								</div>
							</div>
						</div>
					)}
					{/* Conversation Feed */}
					{textMessages.length > 0 && (
						<div className="mt-10 sm:mt-14 w-full max-w-[800px] space-y-4 max-h-[950px] overflow-y-auto px-4">
							{textMessages.map((msg, idx) => (
								<div
									key={idx}
									className={`flex ${
										msg.role === "user" ? "justify-end" : "justify-start"
									}`}
								>
									<div
										className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
											msg.role === "user"
												? "bg-gradient-to-r from-[#d9b8ff] to-[#bfa3ff] text-gray-900"
												: "bg-white border border-gray-200 text-gray-700"
										}`}
									>
										{msg.content}
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

					{/* Example Prompts — Visible until first user message */}
					{textMessages.length === 0 && (
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
											setIsConversationActive(true);
											animateThenSubmit(example);
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
				</div>
			</main>
			<Sidebar />
			{/* FooterBar only AFTER conversation starts */}
			<div className="fixed bottom-4 left-0 w-full flex justify-center z-50">
				<FooterBar
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
