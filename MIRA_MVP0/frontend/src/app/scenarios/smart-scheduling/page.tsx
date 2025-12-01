/** @format */
"use client";

import HeaderBar from "@/components/HeaderBar";

import FooterBar from "@/components/FooterBar";
import {
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
} from "@/utils/voice/voiceHandler";
import { useCallback, useEffect, useState } from "react";
import Orb from "@/components/Orb";
import ThinkingPanel from "./components/ThinkingPanel";
import CalendarSummaryPanel from "./components/CalendarSummaryPanel";
import CalendarConflictDetection from "./components/CalendarConflictDetection";
import ReschedulingPanel from "./components/ReschedulingPanel";
import MeetingConfirmationUI from "./components/MeetingConfirmationUI";
import Sidebar from "@/components/Sidebar";
import { getWeather } from "@/utils/weather";

export default function CalendarFlowPage() {
	const [stage, setStage] = useState<
		"thinking" | "summary" | "conflict" | "rescheduling" | "confirmation"
	>("thinking");
	// FooterBar states

	const [isListening, setIsListening] = useState(true); // mic selected by default
	const [isTextMode, setIsTextMode] = useState(false);
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [isMuted, setIsMuted] = useState(false);

	// weather
	const [weatherCode, setWeatherCode] = useState<number | null>(null);
	const [weatherDescription, setWeatherDescription] = useState<string | null>(
		null
	);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
	const [location, setLocation] = useState<string>("Detecting...");
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
	const [timezone, setTimezone] = useState<string>(
		Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
	);

	const [textMessages, setTextMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);
	useEffect(() => {
		const timers: NodeJS.Timeout[] = [];

		timers.push(setTimeout(() => setStage("summary"), 2000)); // 2s
		timers.push(setTimeout(() => setStage("conflict"), 4000)); // 4s
		timers.push(setTimeout(() => setStage("rescheduling"), 6000)); // 6s
		timers.push(setTimeout(() => setStage("confirmation"), 8500)); // 8.5s

		return () => timers.forEach((t) => clearTimeout(t));
	}, []);

	const sampleEvents = [
		{
			id: "1",
			title: "Project Timeline & Budget Discussion",
			time: "12 pm - 1 pm",
			attendee: "David Olibear",
			provider: "google",
		},
		{
			id: "2",
			title: "Quarterly Budget Review",
			time: "2 pm - 2:30 pm",
			attendee: "Sam Altman",
			provider: "google",
		},
		{
			id: "3",
			title: "Marketing Budget Approval",
			time: "4 pm - 5 pm",
			attendee: "Kate Foret",
			provider: "google",
		},
		{
			id: "4",
			title: "Revised Marketing Budget",
			time: "4 pm - 5 pm",
			attendee: "Sam Foleigh",
			provider: "teams",
		},
	];

	const rescheduledEvents = sampleEvents.map((ev) =>
		ev.id === "4" ? { ...ev, time: "10:00 am - 10:30 am" } : ev
	);

	const [input, setInput] = useState("");
	const [isLoadingResponse, setIsLoadingResponse] = useState(false);
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
					scenarioTag="smart-scheduling"
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

					{/* PANEL */}

					<div className="w-full flex justify-center">
						<div className="w-full max-w-[800px] mx-auto">
							{stage === "thinking" && (
								<div className="max-w-[800px] mt-14 bg-[#F8F8FB] rounded-xl">
									<ThinkingPanel />
								</div>
							)}

							{/* All other stages inside SCROLL CONTAINER */}
							{stage !== "thinking" && (
								<div className="relative mt-14 w-full max-w-[800px]">
									{/* Scrollable content */}
									<div
										className="
						max-h-[58vh] 
						overflow-y-scroll 
						no-scrollbar 
						bg-white 
						border 
						border-gray-200 
						rounded-[25px] 
						relative 
						z-10 
						w-full
					"
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
										{stage === "summary" && (
											<CalendarSummaryPanel
												events={sampleEvents}
												totalEvents={4}
												totalMeet={3}
												totalTeams={1}
												nextEventTitle="Project Timeline & Budget Discussion"
											/>
										)}

										{stage === "conflict" && (
											<CalendarConflictDetection
												events={sampleEvents}
												totalEvents={sampleEvents.length}
												totalMeet={3}
												totalTeams={1}
												nextEventTitle="Project Timeline & Budget Discussion"
											/>
										)}

										{stage === "rescheduling" && <ReschedulingPanel />}

										{stage === "confirmation" && (
											<MeetingConfirmationUI
												events={rescheduledEvents}
												rescheduledEventId="4"
												newTime="10:00 AM – 10:30 AM"
											/>
										)}
									</div>

									{/* Scroll-frame overlay */}
									<div
										className="
						scroll-frame 
						pointer-events-none 
						absolute top-0 left-0 
						w-full h-6 
						bg-gradient-to-b 
						from-[#F8F8FB] 
						to-transparent 
						opacity-0 
						transition-opacity 
						duration-300 
						rounded-t-[25px]
					"
									></div>
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
