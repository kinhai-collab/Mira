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
	// Timezone for formatting the date/time for the detected location.
	// Default to the browser/system timezone — good offline/frontend-only fallback.
	const [timezone, setTimezone] = useState<string>(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
	);
	// Weather state: store coords and current temperature. We'll call Open-Meteo (no API key)

	const greetingCalledRef = useRef(false);
	const [summaryOverlayVisible, setSummaryOverlayVisible] = useState(true); // ✅ Changed to true so it's visible on this page
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

	const handleMuteToggle = () => {
		const muteState = !isMuted;
		setIsMuted(muteState);
		setMiraMute(muteState);
	};
	// Removed unused handleMicToggle
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

	useEffect(() => {
		if (latitude != null && longitude != null) {
			fetchWeatherForCoords(latitude, longitude);
		}
	}, [latitude, longitude]);
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

			// Refresh or validate token
			const { getValidToken } = await import("@/utils/auth");
			const validToken = await getValidToken();

			if (!validToken) {
				router.push("/login");
				return;
			}

			// 🚨 FIX: START MIRA ONLY AFTER TOKEN IS VALID
			startMiraVoice();
			setIsConversationActive(true);

			// Continue your existing logic
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

			if (!greetingCalledRef.current) {
				greetingCalledRef.current = true;

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

					const firstName =
						userName !== "there" ? userName.split(" ")[0] : userName;

					setGreeting(`${timeGreeting}, ${firstName}!`);
				}, 300);
			}
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

	// Load data from sessionStorage on mount (for navigation from home page)
	useEffect(() => {
		if (typeof window !== "undefined") {
			const storedData = sessionStorage.getItem("mira_email_calendar_data");
			if (storedData) {
				try {
					const data = JSON.parse(storedData) as VoiceSummaryEventDetail;
					console.log(
						"📦 Smart Summary: Loading data from sessionStorage",
						data
					);

					const rawSteps = data.steps?.length
						? data.steps
						: DEFAULT_SUMMARY_STEPS;
					const normalizedCalendarEvents: VoiceSummaryCalendarEvent[] =
						Array.isArray(data.calendarEvents) ? data.calendarEvents : [];

					setSummarySteps(prepareVoiceSteps(rawSteps));
					setSummaryEmails(data.emails ?? []);
					setSummaryEvents(normalizedCalendarEvents);
					setSummaryFocus(data.focus ?? null);
					setSummaryStage("thinking");
					setSummaryOverlayVisible(true);
					setSummaryRunId((id) => id + 1);

					// Clear the stored data after loading
					sessionStorage.removeItem("mira_email_calendar_data");
					console.log("🗑️ Smart Summary: Cleared sessionStorage");
				} catch (error) {
					console.error("❌ Smart Summary: Error parsing stored data", error);
					sessionStorage.removeItem("mira_email_calendar_data");
				}
			}
		}
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

			console.log("📧 Smart Summary: Received email/calendar data via event:", {
				emails: detail.emails?.length || 0,
				events: normalizedCalendarEvents.length || 0,
				steps: rawSteps.length,
			});

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
			console.log(
				"✅ Smart Summary: Event listener registered for miraEmailCalendarSummary"
			);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"miraEmailCalendarSummary",
					handler as EventListener
				);
				console.log("🔄 Smart Summary: Event listener cleaned up");
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

	// Handle text input submission
	const handleTextSubmit = async (text?: string) => {
		const queryText = text || input.trim();
		if (!queryText) return;

		// Add user message
		setTextMessages((prev) => [...prev, { role: "user", content: queryText }]);
		setInput("");
		setIsLoadingResponse(true);

		try {
			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");

			const { getValidToken } = await import("@/utils/auth");
			const token = await getValidToken();

			const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

			const response = await fetch(`${apiBase}/api/text-query`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: "include",
				body: JSON.stringify({
					query: queryText,
					history: textMessages,
					token,
					timezone: detectedTimezone,
				}),
			});

			if (!response.ok) {
				const err = await response.text();
				console.error("Backend error:", err);
				throw new Error(err);
			}

			const data = await response.json();

			// ----- NAVIGATION ACTIONS -----
			if (data.action === "navigate" && data.actionTarget) {
				setTimeout(() => router.push(data.actionTarget), 300);
				setTextMessages((p) => [
					...p,
					{ role: "assistant", content: data.text || "Navigating..." },
				]);
				return;
			}

			if (data.action === "calendar_flow") {
				router.push("/scenarios/smart-scheduling");
				return;
			}

			if (data.action === "open_smart_summary") {
				setTextMessages((p) => [
					...p,
					{ role: "assistant", content: data.text || "" },
				]);
				router.push("/scenarios/smart-summary");
				return;
			}

			// ----- SMART SUMMARY ACTION -----
			if (data.action === "email_calendar_summary") {
				console.log(
					"📧 Smart Summary Page: Received email_calendar_summary action",
					data.actionData
				);

				if (data.text) {
					setPendingSummaryMessage(data.text);
				}

				// Directly update state since we're already on the smart-summary page
				if (data.actionData) {
					const detail = data.actionData;
					const rawSteps = detail.steps?.length
						? detail.steps
						: DEFAULT_SUMMARY_STEPS;
					const normalizedCalendarEvents: VoiceSummaryCalendarEvent[] =
						Array.isArray(detail.calendarEvents) ? detail.calendarEvents : [];

					console.log("📧 Smart Summary Page: Setting state directly", {
						emails: detail.emails?.length || 0,
						events: normalizedCalendarEvents.length || 0,
					});

					setSummarySteps(prepareVoiceSteps(rawSteps));
					setSummaryEmails(detail.emails ?? []);
					setSummaryEvents(normalizedCalendarEvents);
					setSummaryFocus(detail.focus ?? null);
					setSummaryStage("thinking");
					setSummaryOverlayVisible(true);
					setSummaryRunId((id) => id + 1);
				}

				return;
			}

			// Default assistant reply
			if (data.text) {
				setTextMessages((p) => [
					...p,
					{ role: "assistant", content: data.text },
				]);
			}
		} catch (err) {
			console.error("Error:", err);
			setTextMessages((p) => [
				...p,
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
			<div className="fixed top-0 left-0 w-full bg-[#F8F8FB] pl-[70px] md:pl-[90px]">
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
			</div>

			{/* Main */}
			<main className="max-sm:mt-6 flex-1 flex flex-col items-center px-2 sm:px-4 md:px-6">
				{/* SCALE CONTAINER */}
				<div className="scale-[0.85] flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
					{/* ORB (must NOT be fixed) */}
					<div className="mt-4 relative flex flex-col items-center">
						<div
							className="w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br 
		from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5]
		shadow-[0_0_80px_15px_rgba(210,180,255,0.45)] animate-pulse"
						></div>
					</div>
					{/* PANEL CONTAINER */}
					<div className="w-full mt-10 flex justify-center mt-0">
						<div className="w-full max-w-[800px] mx-auto">
							{/* THINKING PANEL */}
							{summaryStage === "thinking" && (
								<div className="max-w-[800px] bg-[#F8F8FB] rounded-xl">
									<EmailCalendarOverlay
										visible={true}
										stage="thinking"
										steps={summarySteps}
										isMuted={isMuted}
									/>
								</div>
							)}

							{/* SUMMARY PANEL */}
							{summaryStage === "summary" && (
								<div className="relative w-full max-w-[800px]">
									{/* SCROLLABLE CONTENT (same style as Morning Brief Recommendation Panel) */}

									<EmailCalendarOverlay
										key={summaryRunId}
										visible={true}
										stage="summary"
										steps={summarySteps}
										emails={summaryEmails}
										calendarEvents={summaryEvents}
										focusNote={summaryFocus}
										isMuted={isMuted}
									/>
								</div>
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
