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
	const [isMovingDown, setIsMovingDown] = useState(false);

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

			console.log("📧 Smart Summary: Received email/calendar data:", {
				emails: detail.emails?.length || 0,
				events: normalizedCalendarEvents.length || 0,
				steps: rawSteps.length
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
			console.log("✅ Smart Summary: Event listener registered for miraEmailCalendarSummary");
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
				console.log("📧 Smart Summary Page: Received email_calendar_summary action", data.actionData);
				
				if (data.text) {
					setPendingSummaryMessage(data.text);
				}

				// Dispatch event to trigger the overlay
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraEmailCalendarSummary", {
							detail: data.actionData ?? {},
						})
					);
					console.log("✅ Smart Summary Page: Dispatched miraEmailCalendarSummary event with data");
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
				scenarioTag="smart-summary"
			/>
			<main className="flex-1 flex flex-col items-center px-2 sm:px-4 md:px-6">
				{/* SCALE CONTAINER */}
				<div className="scale-[0.85] flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
					{/* Orb + Greeting */}
					<div className="orb-wrapper mt-9 max-sm:mt-8">
						<Orb hasMessages={textMessages.length > 0} />
					</div>

					{/* Email & calendar thinking panel */}
					{summaryOverlayVisible && (
						<div className="mt-10 flex w-full justify-center px-4">
							<EmailCalendarOverlay
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
								visible={summaryOverlayVisible}
							/>
						</div>
					)}
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
