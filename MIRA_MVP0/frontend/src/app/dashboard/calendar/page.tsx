/** @format */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
	fetchEventList,
	createEvent,
	type CalendarEvent,
} from "@/utils/dashboardApi";
import { getWeather } from "@/utils/weather";
import { useVoiceNavigation } from "@/utils/voice/navigationHandler";
import { startMiraVoice, stopMiraVoice } from "@/utils/voice/voiceHandler";
import { CalendarModal } from "@/components/CalendarModal";
import Sidebar from "@/components/Sidebar";
import HeaderBar from "@/components/HeaderBar";

// --- Helpers ---
const getStartOfWeek = (date: Date) => {
	const d = new Date(date);
	const day = d.getDay(); // 0 (Sun) to 6 (Sat)
	const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to start on Monday (or Sunday?)
	// Design has "Su Mo Tu We Th Fr Sa" in mini calendar.
	// Week view usually starts Sun or Mon. I'll stick to Sunday start for now as common default.
	const start = new Date(d.setDate(d.getDate() - day));
	start.setHours(0, 0, 0, 0);
	return start;
};

const addDays = (date: Date, days: number) => {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
};

const formatTime = (dateStr: string) => {
	try {
		return new Date(dateStr).toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	} catch {
		return "";
	}
};

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23

// --- Components ---

function MiniCalendar({
	selectedDate,
	onDateSelect,
}: {
	selectedDate: Date;
	onDateSelect: (d: Date) => void;
}) {
	const [viewDate, setViewDate] = useState(new Date(selectedDate));

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	// Build 6×7 matrix
	const getMatrix = (year: number, month: number) => {
		const firstOfMonth = new Date(year, month, 1);
		const startDay = firstOfMonth.getDay(); // Sunday = 0

		// Start from the Sunday before the 1st (or the 1st itself if Sunday)
		const startDate = new Date(year, month, 1 - startDay);

		const matrix: Date[][] = [];
		for (let week = 0; week < 6; week++) {
			const row: Date[] = [];
			for (let day = 0; day < 7; day++) {
				const d = new Date(startDate);
				d.setDate(startDate.getDate() + week * 7 + day);
				row.push(d);
			}
			matrix.push(row);
		}

		return matrix;
	};

	const matrix = getMatrix(year, month);
	const today = new Date();

	return (
		<div className="w-full px-2 py-2">
			{/* Header with month navigation */}
			<div className="flex items-center justify-between mb-2 py-2">
				<button
					onClick={() => setViewDate(new Date(year, month - 1, 1))}
					className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200"
				>
					<span className="text-gray-600 text-lg">‹</span>
				</button>

				<span className="text-[18px] font-normal text-black">
					{viewDate.toLocaleDateString("en-US", {
						month: "long",
						year: "numeric",
					})}
				</span>

				<button
					onClick={() => setViewDate(new Date(year, month + 1, 1))}
					className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200"
				>
					<span className="text-gray-600 text-lg">›</span>
				</button>
			</div>
			{/* Weekday names */}
			<div className="grid grid-cols-7 w-full mb-2">
				{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
					<div key={d} className="flex items-center justify-center h-[30px]">
						<span className="text-[14px] text-black">{d}</span>
					</div>
				))}
			</div>

			{/* Dates grid */}
			<div className="grid grid-cols-7 w-full">
				{matrix.flat().map((day, idx) => {
					const isCurrentMonth = day.getMonth() === month;
					const isSelected = day.toDateString() === selectedDate.toDateString();
					const isToday = day.toDateString() === today.toDateString();

					return (
						<button
							key={idx}
							onClick={() => onDateSelect(day)}
							className={`
          flex items-center justify-center h-[30px] rounded-full text-[14px]
          ${
						isSelected
							? "bg-[#E0D9FC] text-[#444444]"
							: isToday
							? "bg-[#917CF4] text-[#E5E5E5]"
							: isCurrentMonth
							? "text-[#444] hover:bg-gray-100"
							: "text-[#BFBFBF]"
					}
        `}
						>
							{day.getDate()}
						</button>
					);
				})}
			</div>
		</div>
	);
}

type ViewMode = "day" | "week" | "month" | "year";

export default function CalendarPage() {
	const router = useRouter();
	
	// Enable voice navigation
	useVoiceNavigation();
	
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [events, setEvents] = useState<CalendarEvent[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [viewMode, setViewMode] = useState<ViewMode>("day");

	const [showDropdown, setShowDropdown] = useState(false);
	// Modal state
	const [isModalOpen, setIsModalOpen] = useState(false);
	
	// Voice control state
	const [isVoiceActive, setIsVoiceActive] = useState(false);
	
	// Handle voice toggle
	const toggleVoice = () => {
		if (isVoiceActive) {
			stopMiraVoice();
			setIsVoiceActive(false);
		} else {
			startMiraVoice();
			setIsVoiceActive(true);
		}
	};
	const [modalDate, setModalDate] = useState(new Date());

	// Weather & location state
	const [location, setLocation] = useState<string>("New York");
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
	const [temp, setTemp] = useState<number | null>(null);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	// Load events
	const loadEvents = async () => {
		setIsLoading(true);
		let startDate: Date;
		let endDate: Date;

		if (viewMode === "week") {
			startDate = getStartOfWeek(selectedDate);
			endDate = addDays(startDate, 7);
		} else if (viewMode === "day") {
			startDate = new Date(selectedDate);
			startDate.setHours(0, 0, 0, 0);
			endDate = addDays(startDate, 1);
		} else if (viewMode === "month") {
			startDate = new Date(
				selectedDate.getFullYear(),
				selectedDate.getMonth(),
				1
			);
			endDate = new Date(
				selectedDate.getFullYear(),
				selectedDate.getMonth() + 1,
				0
			);
			endDate.setHours(23, 59, 59, 999);
		} else if (viewMode === "year") {
			startDate = new Date(selectedDate.getFullYear(), 0, 1);
			endDate = new Date(selectedDate.getFullYear(), 11, 31, 23, 59, 59, 999);
		} else {
			// Default to week
			startDate = getStartOfWeek(selectedDate);
			endDate = addDays(startDate, 7);
		}

		try {
			const data = await fetchEventList(startDate, endDate);
			setEvents(data.events || []);
		} catch (err) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadEvents();
	}, [selectedDate, viewMode]);

	// ✅ Listen for calendar updates and refresh events
	useEffect(() => {
		const handleCalendarUpdate = () => {
			console.log("📅 Calendar updated, refreshing events...");
			loadEvents();
		};

		if (typeof window !== "undefined") {
			window.addEventListener("miraCalendarUpdated", handleCalendarUpdate);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("miraCalendarUpdated", handleCalendarUpdate);
			}
		};
	}, []); // Only register once, loadEvents will use current selectedDate/viewMode

	// Fetch weather using Open-Meteo API directly
	const fetchWeatherForCoords = useCallback(
		async (lat: number, lon: number) => {
			try {
				setIsWeatherLoading(true);
				console.log("Calendar page: fetching weather for coords:", lat, lon);
				const data = await getWeather(lat, lon);
				const temp = data?.temperatureC;
				if (typeof temp === "number") setTemp(temp);
			} catch (err) {
				console.error("Calendar page: Error fetching weather:", err);
			} finally {
				setIsWeatherLoading(false);
			}
		},
		[]
	);

	// Get coords either via geolocation or IP fallback, then fetch weather
	useEffect(() => {
		const ipFallback = async () => {
			try {
				const res = await fetch("https://ipapi.co/json/");
				if (!res.ok) return;
				const data = await res.json();
				const city =
					data.city || data.region || data.region_code || data.country_name;
				if (city) setLocation(city);
				if (data.latitude && data.longitude) {
					fetchWeatherForCoords(Number(data.latitude), Number(data.longitude));
				}
			} catch (e) {
				console.error("Calendar page IP fallback error:", e);
			} finally {
				setIsLocationLoading(false);
			}
		};

		if (!("geolocation" in navigator)) {
			ipFallback();
			return;
		}

		const success = async (pos: GeolocationPosition) => {
			try {
				const { latitude: lat, longitude: lon } = pos.coords;

				// Use OpenStreetMap Nominatim reverse geocoding (no key required)
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
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

				fetchWeatherForCoords(lat, lon).catch((e) => console.error(e));
			} catch (err) {
				console.error("Calendar page reverse geocode error:", err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const failure = async (err: GeolocationPositionError) => {
			console.warn("Calendar page geolocation failed:", err);
			await ipFallback();
		};

		navigator.geolocation.getCurrentPosition(success, failure, {
			timeout: 10000,
		});
	}, [fetchWeatherForCoords]);

	const handleSlotClick = (day: Date, hour: number) => {
		const d = new Date(day);
		d.setHours(hour);
		setModalDate(d);
		setIsModalOpen(true);
	};

	const handleCreateEvent = async (eventData: {
		summary: string;
		start: string;
		end: string;
		description?: string;
		location?: string;
		attendees?: string[];
	}) => {
		try {
			console.log("Creating event with data:", eventData);
			await createEvent(eventData);
			// Refresh events
			await loadEvents();
			// Close modal
			setIsModalOpen(false);
		} catch (error) {
			console.error("Failed to create event:", error);
			alert("Failed to create event. Please try again.");
		}
	};

	const weekStart = getStartOfWeek(selectedDate);
	const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

	// Hours from 7 AM to midnight (7-23), then 00-06 for a full day view
	const displayHours = [
		7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3,
		4, 5, 6,
	];

	// Helper function to determine event icon and color based on meeting link
	// Note: calendar_provider (google/outlook) is NOT used for icon selection
	// Only meeting links and meeting providers determine the icon
	const getEventIcon = (event: CalendarEvent) => {
		const link = (event.meetingLink || "").toLowerCase();
		const provider = (event.provider || "").toLowerCase();

		// Check link first (most reliable) - only for actual meeting links
		if (
			link.includes("meet.google.com") ||
			link.includes("hangouts.google.com") ||
			link.includes("google.com/meet")
		) {
			return { icon: "/Icons/logos_google-meet.svg", color: "#4285F4" };
		} else if (
			link.includes("teams.microsoft.com") ||
			link.includes("teams.live.com") ||
			link.includes("microsoft.com/teams")
		) {
			return { icon: "/Icons/logos_microsoft-teams.svg", color: "#6264A7" };
		} else if (link.includes("zoom.us") || link.includes("zoom.com")) {
			return { icon: "/Icons/fluent_person-16-filled.svg", color: "#2D8CFF" };
		}

		// Fallback to provider field - only for specific meeting provider names
		// Only check for specific meeting provider names, not generic "google" or "outlook"
		if (provider === "google-meet") {
			return { icon: "/Icons/logos_google-meet.svg", color: "#4285F4" };
		} else if (provider === "microsoft-teams" || provider === "teams") {
			return { icon: "/Icons/logos_microsoft-teams.svg", color: "#6264A7" };
		} else if (provider === "zoom") {
			return { icon: "/Icons/fluent_person-16-filled.svg", color: "#2D8CFF" };
		}

		// Default: no meeting link or provider (personal event)
		// Always use person icon for events without meeting links
		return { icon: "/Icons/fluent_person-16-filled.svg", color: "#9CA3AF" };
	};

	// Get today's events for the sidebar
	const todayEvents = events
		.filter((evt) => {
			if (!evt.start) return false;
			const evtDate = new Date(evt.start);
			const today = new Date();
			return evtDate.toDateString() === today.toDateString();
		})
		.sort((a, b) => {
			const aTime = new Date(a.start!).getTime();
			const bTime = new Date(b.start!).getTime();
			return aTime - bTime;
		});

	// Group events by type (you can categorize based on event properties)
	const groupedEvents = {
		all: todayEvents,
		meeting: todayEvents.filter(
			(e) =>
				e.title.toLowerCase().includes("meeting") ||
				e.title.toLowerCase().includes("sync")
		),
		team: todayEvents.filter(
			(e) =>
				e.title.toLowerCase().includes("team") ||
				e.title.toLowerCase().includes("standup")
		),
		personal: todayEvents.filter(
			(e) =>
				!e.title.toLowerCase().includes("meeting") &&
				!e.title.toLowerCase().includes("team")
		),
	};

	// Generate month calendar grid
	const getMonthGrid = () => {
		const year = selectedDate.getFullYear();
		const month = selectedDate.getMonth();

		const firstDay = new Date(year, month, 1);
		const startIndex = firstDay.getDay(); // Sun=0 ... Sat=6
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		const weeks: Date[][] = [];
		let currentWeek: Date[] = [];

		// Fill leading days (previous month)
		for (let i = 0; i < startIndex; i++) {
			currentWeek.push(new Date(year, month, -(startIndex - 1 - i)));
		}

		// Fill actual days of month
		for (let day = 1; day <= daysInMonth; day++) {
			currentWeek.push(new Date(year, month, day));

			if (currentWeek.length === 7) {
				weeks.push(currentWeek);
				currentWeek = [];
			}
		}

		// Fill trailing days (next month)
		if (currentWeek.length > 0) {
			const remaining = 7 - currentWeek.length;
			for (let i = 1; i <= remaining; i++) {
				currentWeek.push(new Date(year, month + 1, i));
			}
			weeks.push(currentWeek);
		}

		// Make sure we always return exactly 6 rows
		while (weeks.length < 6) {
			const lastWeek = weeks[weeks.length - 1];
			const lastDate = lastWeek[lastWeek.length - 1];
			const fillerWeek = [];
			for (let i = 1; i <= 7; i++) {
				fillerWeek.push(
					new Date(
						lastDate.getFullYear(),
						lastDate.getMonth(),
						lastDate.getDate() + i
					)
				);
			}
			weeks.push(fillerWeek);
		}

		return weeks;
	};

	const monthGrid = getMonthGrid();

	return (
		<div className="flex flex-col h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden font-['Outfit']">
			<CalendarModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSave={handleCreateEvent}
				initialDate={modalDate}
			/>

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
					isLocationLoading={isLocationLoading}
					isWeatherLoading={isWeatherLoading}
				/>
			</div>

			{/* Events Header - Full Width */}
			<div className="bg-[#F8F8FB] mt-10 px-10 pt-6 pb-2 flex-shrink-0">
				<h1 className="text-[30px] font-normal text-[#282829] tracking-[0.2px] leading-none mb-2">
					Events
				</h1>
				<p className="text-[18px] pt-2 font-normal text-black tracking-[0.1px] leading-none">
					Check your schedule
				</p>
			</div>

			{/* Breadcrumb - Full Width */}
			{/* Breadcrumb - Full Width */}
			<div className="bg-[#F8F8FB] px-10 pb-3 flex-shrink-0">
				<button
					onClick={() => router.push("/dashboard")}
					className="flex items-center gap-2 hover:opacity-70 transition"
				>
					<Image
						src="/Icons/left arrow.png"
						alt="Back"
						width={20}
						height={20}
						className="object-contain"
					/>

					<span className="text-[16px] font-normal text-[#282829] tracking-[0.1px]">
						Dashboard
					</span>
				</button>
			</div>

			{/* Main Content Area: Sidebar + Calendar */}
			<div className="flex flex-1 min-h-0 px-10 pb-10 gap-0 justify-center">
				<div className="flex flex-1 max-w-[1440px] gap-0">
					{/* Sidebar Panel */}
					<div className="w-[306px] flex-shrink-0 bg-white border-r border-[#dadce0] flex flex-col border border-gray-200 rounded-l-lg shadow-sm">
						{/* Mini Calendar */}
						<div className="p-2 flex justify-start">
							<MiniCalendar
								selectedDate={selectedDate}
								onDateSelect={setSelectedDate}
							/>
						</div>

						{/* Event List Section */}
						<div className="flex-1 overflow-y-auto px-4 py-2.5">
							<div className="mb-2">
								<div className="flex items-center gap-2 mb-2.5">
									<span className="text-[16px] font-normal text-[#333333]">
										Today&apos;s Events
									</span>
									{isLoading && (
										<span className="text-[12px] text-gray-400">
											Loading...
										</span>
									)}
								</div>

								{/* All Events */}
								{groupedEvents.all.length > 0 && (
									<>
										<p className="text-[14px] font-normal text-[#333333] mb-2.5">
											All
										</p>
										<div className="space-y-0.5 mb-4">
											{groupedEvents.all.map((evt) => {
												const iconData = getEventIcon(evt);
												const startTime = formatTime(evt.start!.toString());
												return (
													<div
														key={evt.id}
														className="flex items-center gap-1 py-0.5 px-0.5 rounded-md h-[19px]"
													>
														<div className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
															<Image
																src={iconData.icon}
																alt=""
																width={18}
																height={18}
																className="object-contain"
															/>
														</div>
														<span
															className="text-[12px] font-normal text-[#282829] flex-1 min-w-0 truncate"
															title={evt.title}
														>
															{evt.title}
														</span>
														<span className="text-[12px] font-normal text-[#333333]">
															{startTime}
														</span>
													</div>
												);
											})}
										</div>
									</>
								)}

								{/* Meeting Events */}
								{groupedEvents.meeting.length > 0 && (
									<>
										<p className="text-[14px] font-normal text-[#333333] mb-2.5">
											Meeting
										</p>
										<div className="space-y-0.5 mb-4">
											{groupedEvents.meeting.map((evt) => {
												const iconData = getEventIcon(evt);
												const startTime = formatTime(evt.start!.toString());
												return (
													<div
														key={evt.id}
														className="flex items-center gap-1 py-0.5 px-0.5 rounded-md h-[19px]"
													>
														<div className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
															<Image
																src={iconData.icon}
																alt=""
																width={18}
																height={18}
																className="object-contain"
															/>
														</div>
														<span
															className="text-[12px] font-normal text-[#282829] flex-1 min-w-0 truncate"
															title={evt.title}
														>
															{evt.title}
														</span>
														<span className="text-[12px] font-normal text-[#333333]">
															{startTime}
														</span>
													</div>
												);
											})}
										</div>
									</>
								)}

								{/* Team Events */}
								{groupedEvents.team.length > 0 && (
									<>
										<p className="text-[14px] font-normal text-[#333333] mb-2.5">
											Team
										</p>
										<div className="space-y-0.5 mb-4">
											{groupedEvents.team.map((evt) => {
												const iconData = getEventIcon(evt);
												const startTime = formatTime(evt.start!.toString());
												return (
													<div
														key={evt.id}
														className="flex items-center gap-1 py-0.5 px-0.5 rounded-md h-[19px]"
													>
														<div className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
															<Image
																src={iconData.icon}
																alt=""
																width={18}
																height={18}
																className="object-contain"
															/>
														</div>
														<span
															className="text-[12px] font-normal text-[#282829] flex-1 min-w-0 truncate"
															title={evt.title}
														>
															{evt.title}
														</span>
														<span className="text-[12px] font-normal text-[#333333]">
															{startTime}
														</span>
													</div>
												);
											})}
										</div>
									</>
								)}

								{/* Personal Events */}
								{groupedEvents.personal.length > 0 && (
									<>
										<p className="text-[14px] font-normal text-[#333333] mb-2.5">
											Personal
										</p>
										<div className="space-y-0.5 mb-4">
											{groupedEvents.personal.map((evt) => {
												const iconData = getEventIcon(evt);
												const startTime = formatTime(evt.start!.toString());
												return (
													<div
														key={evt.id}
														className="flex items-center gap-1 py-0.5 px-0.5 rounded-md h-[19px]"
													>
														<div className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">
															<Image
																src={iconData.icon}
																alt=""
																width={18}
																height={18}
																className="object-contain"
															/>
														</div>
														<span
															className="text-[12px] font-normal text-[#282829] flex-1 min-w-0 truncate"
															title={evt.title}
														>
															{evt.title}
														</span>
														<span className="text-[12px] font-normal text-[#333333]">
															{startTime}
														</span>
													</div>
												);
											})}
										</div>
									</>
								)}

								{/* No events message */}
								{!isLoading && todayEvents.length === 0 && (
									<div className="text-center py-8 text-gray-500">
										<p className="text-[13px]">No events today</p>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Calendar Section */}
					<div className="flex-1 flex flex-col min-w-0">
						{/* Calendar Container */}
						<div className="flex-1 flex flex-col bg-white rounded-r-lg shadow-sm border border-gray-200 border-l-0 overflow-hidden">
							{/* Top Bar - Date Navigation and Controls */}
							<div className="bg-white border-b border-[rgba(218,220,224,0.6)] px-4 py-4 flex items-center justify-between flex-shrink-0">
								<div className="flex items-center gap-4">
									{viewMode === "year" && (
										<button
											onClick={() => {
												const newDate = new Date(selectedDate);
												newDate.setFullYear(selectedDate.getFullYear() - 1);
												setSelectedDate(newDate);
											}}
											className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition"
										>
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
											>
												<path
													d="M10 4L6 8L10 12"
													stroke="#333333"
													strokeWidth="2"
													strokeLinecap="round"
												/>
											</svg>
										</button>
									)}
									<h2 className="text-[24px] font-normal text-[#333333] tracking-[0.12px]">
										{viewMode === "year"
											? selectedDate.getFullYear()
											: `${selectedDate.toLocaleDateString("en-US", {
													month: "long",
													day: "numeric",
											  })}th, ${selectedDate.getFullYear()}`}
									</h2>
									{viewMode === "year" && (
										<button
											onClick={() => {
												const newDate = new Date(selectedDate);
												newDate.setFullYear(selectedDate.getFullYear() + 1);
												setSelectedDate(newDate);
											}}
											className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition"
										>
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
											>
												<path
													d="M6 4L10 8L6 12"
													stroke="#333333"
													strokeWidth="2"
													strokeLinecap="round"
												/>
											</svg>
										</button>
									)}
									{/* View Mode Dropdown */}
									<div className="relative">
										<button
											onClick={() => setShowDropdown((prev) => !prev)}
											className="flex items-center gap-2 border border-[#7b83eb] rounded-[3px] px-3 py-1.5 h-[35px] hover:bg-[#7b83eb]/5 transition"
										>
											<span className="text-[12px] font-normal text-[#7b83eb] capitalize">
												{viewMode}
											</span>
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
											>
												<path
													d="M4 6L8 10L12 6"
													stroke="#7b83eb"
													strokeWidth="2"
													strokeLinecap="round"
												/>
											</svg>
										</button>

										{showDropdown && (
											<div className="absolute mt-1 right-0 w-28 bg-white border border-gray-200 shadow-md rounded-md z-50">
												{["day", "week", "month", "year"].map((item) => (
													<div
														key={item}
														onClick={() => {
															setViewMode(item as ViewMode);
															setShowDropdown(false);
														}}
														className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer capitalize"
													>
														{item}
													</div>
												))}
											</div>
										)}
									</div>
								</div>

								<div className="flex items-center gap-4">
									<button className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">
										<Image
											src="/Icons/search.svg"
											alt="Search"
											width={16}
											height={16}
										/>
									</button>
									<button
										onClick={() => {
											setModalDate(new Date());
											setIsModalOpen(true);
										}}
										className="flex items-center gap-1 px-2 py-1.5 h-[35px] bg-[#7b83eb] text-white rounded-[3px]"
									>
										<span className="text-[12px] font-normal">Add event</span>
										<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
											<circle
												cx="8"
												cy="8"
												r="6"
												fill="white"
												fillOpacity="0.3"
											/>
											<path
												d="M8 5V11M5 8H11"
												stroke="white"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
										</svg>
									</button>
								</div>
							</div>

							{/* Day Headers */}
							{viewMode === "week" && (
								<div className="bg-white border-b border-[#dadce0] flex flex-shrink-0">
									<div className="w-[54px] bg-white flex-shrink-0" />{" "}
									{/* Time axis spacer */}
									{weekDays.map((d, i) => {
										const isToday =
											d.toDateString() === new Date().toDateString();
										const dayName = d.toLocaleDateString("en-US", {
											weekday: "short",
										});
										return (
											<div
												key={i}
												className="flex-1 flex flex-col items-center justify-center gap-2 py-3"
											>
												<span className="text-sm font-normal text-[#333333]">
													{dayName}
												</span>
												<div
													className={`min-w-[32px] h-[32px] px-2 flex items-center justify-center rounded-full ${
														isToday ? "bg-[#917CF4]" : ""
													}`}
												>
													<span
														className={`text-lg font-normal ${
															isToday ? "text-white" : "text-[#333333]"
														}`}
													>
														{d.getDate()}
													</span>
												</div>
											</div>
										);
									})}
								</div>
							)}

							{viewMode === "month" && (
								<div className="bg-white border-b border-[#dadce0] flex flex-shrink-0">
									{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
										(day, i) => (
											<div
												key={i}
												className="flex-1 flex items-center justify-center py-3 border-r border-[#dadce0] last:border-r-0"
											>
												<span className="text-[14px] font-normal text-[#333333]">
													{day}
												</span>
											</div>
										)
									)}
								</div>
							)}

							{/* Calendar Grid */}
							<div className="flex-1 overflow-y-auto bg-white relative">
								{viewMode === "year" ? (
									/* Year View Grid - 3x4 grid of mini months */
									<div className="p-8">
										<div className="grid grid-cols-3 gap-6">
											{Array.from({ length: 12 }, (_, monthIdx) => {
												const monthDate = new Date(
													selectedDate.getFullYear(),
													monthIdx,
													1
												);
												const monthName = monthDate.toLocaleDateString(
													"en-US",
													{ month: "long" }
												);
												const daysInMonth = new Date(
													selectedDate.getFullYear(),
													monthIdx + 1,
													0
												).getDate();
												const firstDayOfMonth = new Date(
													selectedDate.getFullYear(),
													monthIdx,
													1
												).getDay();

												// Build grid for this month
												const monthGrid: (number | null)[] = [];
												// Add empty cells for days before month starts
												for (let i = 0; i < firstDayOfMonth; i++) {
													monthGrid.push(null);
												}
												// Add days of the month
												for (let day = 1; day <= daysInMonth; day++) {
													monthGrid.push(day);
												}

												return (
													<div
														key={monthIdx}
														className="bg-white rounded-lg p-2 border border-gray-200"
													>
														{/* Month Name */}
														<div className="flex items-center justify-center py-2 mb-2">
															<span className="text-[18px] font-normal text-black tracking-[0.09px]">
																{monthName}
															</span>
														</div>

														{/* Day Headers */}
														<div className="grid grid-cols-7 mb-2">
															{["S", "M", "T", "W", "T", "F", "S"].map(
																(day, i) => (
																	<div
																		key={i}
																		className="flex items-center justify-center py-2"
																	>
																		<span className="text-[14px] font-normal text-black tracking-[0.07px]">
																			{day}
																		</span>
																	</div>
																)
															)}
														</div>

														{/* Dates Grid */}
														<div className="grid grid-cols-7 gap-y-1">
															{monthGrid.map((day, idx) => {
																if (day === null) {
																	return <div key={idx} className="h-[30px]" />;
																}

																const currentDate = new Date(
																	selectedDate.getFullYear(),
																	monthIdx,
																	day
																);
																const isToday =
																	currentDate.toDateString() ===
																	new Date().toDateString();
																const isSelected =
																	currentDate.toDateString() ===
																	selectedDate.toDateString();

																return (
																	<button
																		key={idx}
																		onClick={() => {
																			setSelectedDate(currentDate);
																			setViewMode("day"); // Switch to day view when clicking a date
																		}}
																		className={`h-[30px] flex items-center justify-center rounded-full text-[14px] font-normal tracking-[0.07px] transition ${
																			isSelected
																				? "bg-[#917CF4] text-white"
																				: isToday
																				? "bg-[#E0D9FC] text-[#735FF8]"
																				: "text-[#444444] hover:bg-gray-100"
																		}`}
																	>
																		{day}
																	</button>
																);
															})}
														</div>
													</div>
												);
											})}
										</div>
									</div>
								) : viewMode === "month" ? (
									/* Month View Grid */
									/* Month View Grid */
									<div className="h-full flex flex-col">
										{monthGrid.map((week, weekIdx) => (
											<div
												key={weekIdx}
												className="flex h-[140px] border-b border-[#dadce0] last:border-b-0"
											>
												{week.map((day, dayIdx) => {
													const isCurrentMonth =
														day.getMonth() === selectedDate.getMonth();
													const isToday =
														day.toDateString() === new Date().toDateString();
													const isSelected =
														day.toDateString() === selectedDate.toDateString();

													const dayEvents = events.filter((evt) => {
														const evtStart = new Date(evt.start!);
														return (
															evtStart.toDateString() === day.toDateString()
														);
													});

													return (
														<div
															key={dayIdx}
															onClick={() => setSelectedDate(new Date(day))}
															className={`flex-1 border-r border-[#dadce0] last:border-r-0 p-2 cursor-pointer hover:bg-gray-50 transition overflow-hidden
    ${!isCurrentMonth ? "opacity-40" : ""}
  `}
														>
															{/* Day Number */}
															<div className="flex items-center justify-between mb-2">
																<div
																	className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs font-normal
        ${
					isSelected
						? "bg-[#917CF4] text-white"
						: isToday
						? "bg-[#E0D9FC] text-[#735FF8]"
						: "text-[#333333]"
				}
      `}
																>
																	{day.getDate()}
																</div>

																{dayEvents.length > 0 && (
																	<span className="text-[10px] text-gray-500">
																		{String(dayEvents.length).padStart(2, "0")}
																	</span>
																)}
															</div>

															{/* Scrollable Events */}
															<div className="space-y-1 h-[90px] overflow-y-auto pr-1">
																{dayEvents.map((evt, idx) => (
																	<div
																		key={idx}
																		className="bg-[#E0D9FC] border border-[#D0C7FA]
          rounded px-1 py-0.5 overflow-hidden whitespace-nowrap text-ellipsis"
																		title={evt.title}
																	>
																		<div className="flex items-center gap-1">
																			<div className="w-1.5 h-1.5 rounded-full bg-[#735FF8] flex-shrink-0" />
																			<span className="text-[10px] font-normal text-[#735FF8] truncate block max-w-full">
																				{evt.title}
																			</span>
																		</div>

																		<div className="text-[9px] text-[#735FF8] ml-2.5">
																			{formatTime(evt.start!.toString())}
																		</div>
																	</div>
																))}
															</div>
														</div>
													);
												})}
											</div>
										))}
									</div>
								) : (
									/* Day/Week View - Time Grid */
									<div
										className="flex relative"
										style={{ minHeight: `${displayHours.length * 81}px` }}
									>
										{/* Time Axis */}
										<div className="w-[54px] flex-shrink-0 border-r border-[#dadce0] bg-white z-10">
											{displayHours.map((h, idx) => (
												<div
													key={idx}
													className="h-[81px] flex items-start justify-center pt-0 relative"
												>
													<span className="text-[12px] font-normal text-[#333333] mt-[-7px]">
														{h === 0
															? "00:00"
															: `${h.toString().padStart(2, "0")}:00`}
													</span>
												</div>
											))}
										</div>

										{/* Columns - Different rendering for Day vs Week */}
										{viewMode === "day" ? (
											/* Day View: Single Column */
											<div className="flex-1 flex relative">
												<div className="absolute inset-0">
													{displayHours.map((h, idx) => (
														<div
															key={idx}
															onClick={() => handleSlotClick(selectedDate, h)}
															className="h-[81px] border-b border-[#dadce0] bg-white hover:bg-gray-50 transition cursor-pointer"
														/>
													))}
												</div>

												{/* Events for Day View */}
												{events.map((evt) => {
													const start = new Date(evt.start!);
													const end = new Date(evt.end!);

													// Only show events for selected day
													if (
														start.toDateString() !== selectedDate.toDateString()
													)
														return null;

													const startHour = start.getHours();
													const hourIndex = displayHours.indexOf(startHour);
													if (hourIndex === -1) return null;

													const startMinutes = start.getMinutes();
													const durationMinutes =
														(end.getTime() - start.getTime()) / (1000 * 60);

													const top = hourIndex * 81 + (startMinutes / 60) * 81;
													const height = (durationMinutes / 60) * 81;

													return (
														<div
															key={evt.id}
															className="absolute rounded-[3px] border border-[#D0C7FA] bg-[#E0D9FC] px-2 py-1 overflow-hidden hover:shadow-md transition z-10 cursor-pointer"
															style={{
																top: `${top}px`,
																height: `${Math.max(height, 60)}px`,
																left: "4px",
																right: "4px",
															}}
															title={evt.title}
														>
															<div className="font-semibold text-[10px] text-[#735FF8] leading-normal mb-0.5">
																{evt.title}
															</div>
															<div className="text-[10px] font-normal text-[#735FF8] leading-normal">
																{formatTime(evt.start!.toString())}-
																{formatTime(evt.end!.toString())}
															</div>
														</div>
													);
												})}
											</div>
										) : (
											/* Week View: 7 Columns */
											<div className="flex-1 flex relative">
												{/* Background Lines & Click Areas */}
												<div className="absolute inset-0 flex">
													{weekDays.map((d, i) => (
														<div
															key={i}
															className="flex-1 border-r border-[#dadce0] last:border-r-0 h-full relative"
														>
															{displayHours.map((h, idx) => (
																<div
																	key={idx}
																	onClick={() => handleSlotClick(d, h)}
																	className="h-[81px] border-b border-[#dadce0] bg-white hover:bg-gray-50 transition cursor-pointer"
																/>
															))}
														</div>
													))}
												</div>

												{/* Events for Week View */}
												{events.map((evt) => {
													const start = new Date(evt.start!);
													const end = new Date(evt.end!);

													// Filter events not in this week view
													if (
														start < weekStart ||
														start > addDays(weekStart, 7)
													)
														return null;

													// Calculate position
													const dayIndex = Math.floor(
														(start.getTime() - weekStart.getTime()) /
															(1000 * 60 * 60 * 24)
													);
													if (dayIndex < 0 || dayIndex > 6) return null;

													// Map hour to displayHours index
													const startHour = start.getHours();
													const hourIndex = displayHours.indexOf(startHour);
													if (hourIndex === -1) return null;

													const startMinutes = start.getMinutes();
													const durationMinutes =
														(end.getTime() - start.getTime()) / (1000 * 60);

													const top = hourIndex * 81 + (startMinutes / 60) * 81;
													const height = (durationMinutes / 60) * 81;

													return (
														<div
															key={evt.id}
															className="absolute rounded-[3px] border border-[#D0C7FA] bg-[#E0D9FC] px-1 py-0.5 overflow-hidden hover:shadow-md transition z-10 cursor-pointer"
															style={{
																top: `${top}px`,
																height: `${Math.max(height, 60)}px`,
																left: `${(dayIndex * 100) / 7}%`,
																width: `${100 / 7 - 0.5}%`,
																marginLeft: "4px",
																marginRight: "4px",
															}}
															title={evt.title}
														>
															<div className="font-semibold text-[10px] text-[#735FF8] leading-normal mb-0.5">
																{evt.title}
															</div>
															<div className="text-[10px] font-normal text-[#735FF8] leading-normal">
																{formatTime(evt.start!.toString())}-
																{formatTime(evt.end!.toString())}
															</div>
														</div>
													);
												})}
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
			
			{/* Floating Microphone Button */}
			<button
				onClick={toggleVoice}
				className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 hover:scale-110 active:scale-95 ${
					isVoiceActive 
						? 'bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse' 
						: 'bg-gradient-to-br from-purple-600 to-indigo-600 hover:shadow-purple-500/50'
				}`}
				aria-label={isVoiceActive ? "Stop voice assistant" : "Start voice assistant"}
			>
				{isVoiceActive ? (
					<svg 
						className="w-7 h-7 text-white" 
						fill="none" 
						stroke="currentColor" 
						viewBox="0 0 24 24"
					>
						<path 
							strokeLinecap="round" 
							strokeLinejoin="round" 
							strokeWidth={2} 
							d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
						/>
						<circle cx="12" cy="12" r="2" fill="currentColor" className="animate-ping opacity-75" />
					</svg>
				) : (
					<svg 
						className="w-7 h-7 text-white" 
						fill="none" 
						stroke="currentColor" 
						viewBox="0 0 24 24"
					>
						<path 
							strokeLinecap="round" 
							strokeLinejoin="round" 
							strokeWidth={2} 
							d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
						/>
					</svg>
				)}
			</button>
			
			<Sidebar />
		</div>
	);
}
