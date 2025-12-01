/** @format */
"use client";

import HeaderBar from "@/components/HeaderBar";
import FooterBar from "@/components/FooterBar";
import {
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
} from "@/utils/voice/voiceHandler";
import { useCallback, useEffect, useState, useRef } from "react";
import ThinkingPanel from "./components/ThinkingPanel";
import CalendarSummaryPanel from "./components/CalendarSummaryPanel";
import CalendarConflictDetection from "./components/CalendarConflictDetection";
import ReschedulingPanel from "./components/ReschedulingPanel";
import MeetingConfirmationUI from "./components/MeetingConfirmationUI";
import AddEventPanel from "./components/AddEventPanel";
import Sidebar from "@/components/Sidebar";
import { getWeather } from "@/utils/weather";
import { EventItem, ConflictInfo } from "./components/types";
import {
	fetchEventsForWindow,
	checkConflicts,
	scheduleEvent,
	rescheduleEvent,
	cancelEvent,
	findAvailableSlots,
	formatTimeRange,
	CalendarEvent,
	ScheduleConflictError,
} from "./utils/calendarApi";

type Stage =
	| "loading"
	| "summary"
	| "conflict"
	| "rescheduling"
	| "confirmation"
	| "add-event";
type ActionType = "rescheduled" | "cancelled" | "scheduled";

export default function SmartSchedulingPage() {
	// Track if we've already loaded events to prevent duplicate loads in Strict Mode
	const hasLoadedRef = useRef(false);

	// Stage management
	const [stage, setStage] = useState<Stage>("loading");
	const [actionType, setActionType] = useState<ActionType>("rescheduled");

	// FooterBar states
	const [isListening, setIsListening] = useState(true);
	const [isTextMode, setIsTextMode] = useState(false);
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [isMuted, setIsMuted] = useState(false);

	// Weather & location
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

	// Text chat
	const [textMessages, setTextMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string }>
	>([]);
	const [input, setInput] = useState("");
	const [isLoadingResponse, setIsLoadingResponse] = useState(false);

	// Calendar data
	const [events, setEvents] = useState<EventItem[]>([]);
	const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
	const [isLoadingEvents, setIsLoadingEvents] = useState(true);
	const [externalConflictMessage, setExternalConflictMessage] = useState<
		string | null
	>(null);
	const [hasExternalConflictSource, setHasExternalConflictSource] =
		useState(false);
	const [externalConflictRawEvents, setExternalConflictRawEvents] = useState<
		any[] | null
	>(null);

	// Rescheduling state
	const [selectedConflict, setSelectedConflict] = useState<ConflictInfo | null>(
		null
	);
	const [eventToReschedule, setEventToReschedule] = useState<EventItem | null>(
		null
	);
	const [availableSlots, setAvailableSlots] = useState<
		Array<{ start: Date; end: Date }>
	>([]);
	const [isLoadingSlots, setIsLoadingSlots] = useState(false);
	const [selectedSlot, setSelectedSlot] = useState<{
		start: Date;
		end: Date;
	} | null>(null);
	const [isRescheduling, setIsRescheduling] = useState(false);

	// Add event state
	const [isScheduling, setIsScheduling] = useState(false);
	const [scheduleConflictError, setScheduleConflictError] =
		useState<ScheduleConflictError | null>(null);

	// Confirmation state
	const [rescheduledEvent, setRescheduledEvent] = useState<EventItem | null>(
		null
	);
	const [newTime, setNewTime] = useState<string>("");

	// Weather fetching
	const fetchWeatherForCoords = useCallback(
		async (lat: number, lon: number) => {
			const openMeteoCodeToDesc = (code: number) => {
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
				const data = await getWeather(lat, lon);
				const temp = data?.temperatureC;
				let desc: string | null = null;
				if (data?.raw?.current_weather?.weathercode !== undefined) {
					const code = Number(data.raw.current_weather.weathercode);
					setWeatherCode(code);
					desc = openMeteoCodeToDesc(code);
				}
				if (typeof temp === "number") setTemperatureC(temp);
				if (desc) setWeatherDescription(desc);
			} catch (err) {
				console.error("Error fetching weather:", err);
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
	}, [latitude, longitude, fetchWeatherForCoords]);

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

	// Convert API event to EventItem format
	const convertToEventItem = (event: CalendarEvent): EventItem => {
		const startDate = event.start.dateTime
			? new Date(event.start.dateTime)
			: event.start.date
			? new Date(event.start.date)
			: new Date();
		const endDate = event.end.dateTime
			? new Date(event.end.dateTime)
			: event.end.date
			? new Date(event.end.date)
			: new Date();

		const formatEventTime = (start: Date, end: Date) => {
			const format = (d: Date) =>
				d.toLocaleTimeString("en-US", {
					hour: "numeric",
					minute: "2-digit",
					hour12: true,
				});
			return `${format(start)} - ${format(end)}`;
		};

		// Determine meeting provider from event
		let provider = "google";
		if (event._provider === "outlook") {
			provider = "teams";
		}

		// Get first attendee name or use "You"
		const attendee =
			event.attendees?.[0]?.displayName ||
			event.attendees?.[0]?.email ||
			"You";

		return {
			id: event.id,
			title: event.summary,
			time: formatEventTime(startDate, endDate),
			attendee,
			provider,
			startDate,
			endDate,
			location: event.location,
			description: event.description,
			calendarProvider: event._provider,
		};
	};

	// Detect conflicts between events
	const detectConflicts = (eventItems: EventItem[]): ConflictInfo[] => {
		const conflictList: ConflictInfo[] = [];

		for (let i = 0; i < eventItems.length; i++) {
			for (let j = i + 1; j < eventItems.length; j++) {
				const a = eventItems[i];
				const b = eventItems[j];

				if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue;

				// Check if they overlap
				if (a.startDate < b.endDate && b.startDate < a.endDate) {
					const overlapStart = new Date(
						Math.max(a.startDate.getTime(), b.startDate.getTime())
					);
					const overlapEnd = new Date(
						Math.min(a.endDate.getTime(), b.endDate.getTime())
					);

					conflictList.push({
						eventA: a,
						eventB: b,
						overlapStart,
						overlapEnd,
					});
				}
			}
		}

		return conflictList;
	};

	// Load events on mount
	useEffect(() => {
		// Prevent duplicate loads in React Strict Mode
		if (hasLoadedRef.current) {
			console.log("⏭️ Skipping duplicate load (React Strict Mode)");
			return;
		}

		const loadEvents = async () => {
			hasLoadedRef.current = true; // Mark as loaded before async operations
			setIsLoadingEvents(true);
			setStage("loading");

			try {
				// Check if we came from homepage with a conflict
				let hasStoredConflict = hasExternalConflictSource;
				let storedConflictEventsRaw: any[] =
					externalConflictRawEvents || [];

				// Only read from sessionStorage the first time; after that rely on state.
				if (!hasStoredConflict && typeof window !== "undefined") {
					const storedConflict =
						sessionStorage.getItem("mira_calendar_conflict");
					if (storedConflict) {
						try {
							const conflictData = JSON.parse(storedConflict);
							if (conflictData.hasConflict) {
								hasStoredConflict = true;
								setHasExternalConflictSource(true);

								if (Array.isArray(conflictData.conflicts)) {
									storedConflictEventsRaw = conflictData.conflicts;
									setExternalConflictRawEvents(conflictData.conflicts);
								}

								if (conflictData.message) {
									setExternalConflictMessage(conflictData.message);
								}

								// Clear it so it doesn't trigger again on hard refresh,
								// but keep our React state so StrictMode double-mount
								// won't lose the context.
								sessionStorage.removeItem("mira_calendar_conflict");
							}
						} catch (e) {
							console.error("Error parsing stored conflict:", e);
						}
					}
				}

				// Get today's events
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const tomorrow = new Date(today);
				tomorrow.setDate(tomorrow.getDate() + 1);

				const calendarEvents = await fetchEventsForWindow(today, tomorrow);
				let eventItems = calendarEvents.map(convertToEventItem);

				// If we came from homepage and have raw conflict events from backend, construct
				// ConflictInfo objects based purely on that payload so the UI always shows a
				// conflict state – even if the conflicting event is just outside "today" (e.g.
				// 1am tomorrow) and wasn't returned in the normal window.
				if (hasStoredConflict && storedConflictEventsRaw.length > 0) {
					const augmentedEvents = [...eventItems];

					const syntheticConflicts: ConflictInfo[] = storedConflictEventsRaw
						.map((c: any, index: number) => {
							try {
								const start = c.start ? new Date(c.start) : undefined;
								const end = c.end ? new Date(c.end) : undefined;
								if (!start || !end) return null;

								// Try to match the existing calendar event first.
								let existingEvent =
									augmentedEvents.find((e) => e.id === c.id) ||
									augmentedEvents.find(
										(e) =>
											!!c.summary &&
											e.title?.toLowerCase() === String(c.summary).toLowerCase()
									);

								// If we can't find it in today's window, synthesise an EventItem
								// from the backend conflict details and add it to the list so it
								// still appears in the grid and can be highlighted.
								if (!existingEvent) {
									existingEvent = {
										id: c.id || `conflict-${index}`,
										title: c.summary || "Conflicting event",
										time: formatTimeRange(start, end),
										attendee: c.attendee || "You",
										provider:
											c.provider === "outlook" || c.calendar === "outlook"
												? "teams"
												: "google",
										startDate: start,
										endDate: end,
										location: c.location,
										description: c.description,
										calendarProvider: c.calendar || "google",
									};
									augmentedEvents.push(existingEvent);
								}

								// Represent the requested event as a synthetic EventItem so
								// the conflict panel can show "overlaps with" information.
								const requestedEvent: EventItem = {
									id: `requested-${existingEvent.id}`,
									title: c.request_summary || "Requested event",
									time: formatTimeRange(start, end),
									attendee: existingEvent.attendee,
									provider: existingEvent.provider,
									startDate: start,
									endDate: end,
									location: c.location || existingEvent.location,
									description: c.description || existingEvent.description,
									calendarProvider: c.calendar || existingEvent.calendarProvider,
								};

								return {
									eventA: existingEvent,
									eventB: requestedEvent,
									overlapStart: start,
									overlapEnd: end,
								} as ConflictInfo;
							} catch (err) {
								console.error("Error constructing conflict from backend data:", err);
								return null;
							}
						})
						.filter(Boolean) as ConflictInfo[];

					// If we managed to build conflicts, use the augmented events + conflict list
					// and go straight into the conflict stage.
					if (syntheticConflicts.length > 0) {
						eventItems = augmentedEvents;
						setEvents(eventItems);
						setConflicts(syntheticConflicts);
						setStage("conflict");
						return;
					}
				}

				// No external conflict payload or it couldn't be parsed – default behaviour.
				setEvents(eventItems);

				// Detect conflicts
				const detectedConflicts = detectConflicts(eventItems);
				setConflicts(detectedConflicts);

				// Determine which stage to show
				// If we came from homepage with a conflict, or detected conflicts, show conflict view
				if (hasStoredConflict || detectedConflicts.length > 0) {
					setStage("conflict");
				} else {
					setStage("summary");
				}
			} catch (error) {
				console.error("Error loading events:", error);
				setStage("summary");
			} finally {
				setIsLoadingEvents(false);
			}
		};

		loadEvents();
	}, []);

	// Refresh events
	const refreshEvents = async (): Promise<EventItem[]> => {
		setIsLoadingEvents(true);
		try {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			const calendarEvents = await fetchEventsForWindow(today, tomorrow);
			const eventItems = calendarEvents.map(convertToEventItem);
			setEvents(eventItems);

			const detectedConflicts = detectConflicts(eventItems);
			setConflicts(detectedConflicts);

			// Return the updated events for immediate use
			return eventItems;
		} catch (error) {
			console.error("Error refreshing events:", error);
			return events; // Return current events on error
		} finally {
			setIsLoadingEvents(false);
		}
	};

	// Handle reschedule initiation
	const handleReschedule = async (
		conflict: ConflictInfo,
		eventToMove: EventItem
	) => {
		setSelectedConflict(conflict);
		setEventToReschedule(eventToMove);
		setStage("rescheduling");
		setIsLoadingSlots(true);

		try {
			// Find available slots for today
			const today = new Date();
			const duration =
				eventToMove.startDate && eventToMove.endDate
					? (eventToMove.endDate.getTime() - eventToMove.startDate.getTime()) /
					  (60 * 1000)
					: 60;

			const slots = await findAvailableSlots(today, duration);
			setAvailableSlots(slots);
		} catch (error) {
			console.error("Error finding slots:", error);
		} finally {
			setIsLoadingSlots(false);
		}
	};

	// Handle slot selection
	const handleSelectSlot = (slot: { start: Date; end: Date }) => {
		setSelectedSlot(slot);
	};

	// Confirm reschedule
	const handleConfirmReschedule = async (slot: { start: Date; end: Date }) => {
		if (!eventToReschedule) return;

		setIsRescheduling(true);

		try {
			const result = await rescheduleEvent({
				eventId: eventToReschedule.id,
				summary: eventToReschedule.title,
				newStart: slot.start,
				newEnd: slot.end,
			});

			if (result.success) {
				// Update the event in our list
				const updatedEvent = {
					...eventToReschedule,
					startDate: slot.start,
					endDate: slot.end,
					time: formatTimeRange(slot.start, slot.end),
				};

				setEvents((prev) =>
					prev.map((e) => (e.id === eventToReschedule.id ? updatedEvent : e))
				);

				setRescheduledEvent(updatedEvent);
				setNewTime(formatTimeRange(slot.start, slot.end));
				setActionType("rescheduled");
				setStage("confirmation");

				// Dispatch event to refresh other components
				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraCalendarUpdated", {
							detail: { action: "reschedule" },
						})
					);
				}
			} else if (result.error) {
				// Handle conflict error
				alert(result.error.message);
			}
		} catch (error) {
			console.error("Error rescheduling:", error);
			alert("Failed to reschedule event. Please try again.");
		} finally {
			setIsRescheduling(false);
		}
	};

	// Handle cancel event
	const handleCancelEvent = async (event: EventItem) => {
		if (!confirm(`Are you sure you want to cancel "${event.title}"?`)) return;

		try {
			const result = await cancelEvent({
				eventId: event.id,
				summary: event.title,
			});

			if (result.success) {
				setEvents((prev) => prev.filter((e) => e.id !== event.id));
				setConflicts((prev) =>
					prev.filter(
						(c) => c.eventA.id !== event.id && c.eventB.id !== event.id
					)
				);

				setRescheduledEvent(event);
				setNewTime(event.time);
				setActionType("cancelled");
				setStage("confirmation");

				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraCalendarUpdated", {
							detail: { action: "cancel" },
						})
					);
				}
			}
		} catch (error) {
			console.error("Error canceling event:", error);
			alert("Failed to cancel event. Please try again.");
		}
	};

	// Handle schedule new event
	const handleScheduleEvent = async (eventData: {
		summary: string;
		start: Date;
		end: Date;
		description?: string;
		location?: string;
		attendees?: string[];
	}) => {
		setIsScheduling(true);
		setScheduleConflictError(null);

		try {
			const result = await scheduleEvent(eventData);

			if (result.success && result.event) {
				const newEvent = convertToEventItem(result.event);
				setEvents((prev) => [...prev, newEvent]);

				setRescheduledEvent(newEvent);
				setNewTime(formatTimeRange(eventData.start, eventData.end));
				setActionType("scheduled");
				setStage("confirmation");

				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraCalendarUpdated", {
							detail: { action: "schedule" },
						})
					);
				}
			} else if (result.error) {
				setScheduleConflictError(result.error);
			}
		} catch (error) {
			console.error("Error scheduling event:", error);
			alert("Failed to schedule event. Please try again.");
		} finally {
			setIsScheduling(false);
		}
	};

	// Handle "suggest other time slots"
	const handleSuggestOther = () => {
		if (rescheduledEvent) {
			setEventToReschedule(rescheduledEvent);
			setStage("rescheduling");
		}
	};

	// Handle "done" from confirmation
	const handleDone = async () => {
		await refreshEvents();
		if (conflicts.length > 0) {
			setStage("conflict");
		} else {
			setStage("summary");
		}
		setRescheduledEvent(null);
		setEventToReschedule(null);
		setSelectedSlot(null);
	};

	// Text query handler
	const handleTextSubmit = async (text?: string) => {
		const queryText = text || input.trim();
		if (!queryText) return;

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
				// Handle conflict errors (409) - when trying to schedule at conflicting time
				if (response.status === 409) {
					try {
						const errorData = await response.json();
						const conflictError = errorData.detail || errorData;

						// Show conflict message in chat
						const conflictMessage =
							conflictError.message ||
							conflictError.natural_response ||
							"I can't schedule that time because there's a conflict with an existing event. Please choose a different time.";

						setTextMessages((prev) => [
							...prev,
							{ role: "assistant", content: conflictMessage },
						]);

						// Refresh events to get the latest state and detect conflicts
						const updatedEvents = await refreshEvents();
						
						// Detect conflicts with the freshly loaded events
						const updatedConflicts = detectConflicts(updatedEvents);
						if (updatedConflicts.length > 0) {
							setConflicts(updatedConflicts);
							setStage("conflict");
						}

						return;
					} catch (parseError) {
						console.error("Error parsing conflict response:", parseError);
						// Fallback: still refresh and try to show conflicts
						await refreshEvents();
						setTimeout(() => {
							const finalConflicts = detectConflicts(events);
							if (finalConflicts.length > 0) {
								setConflicts(finalConflicts);
								setStage("conflict");
							}
						}, 800);
					}
				}

				const errorText = await response.text();
				console.error("Backend error:", response.status, errorText);
				throw new Error(`Backend returned ${response.status}: ${errorText}`);
			}

			const data = await response.json();

			// Handle calendar actions
			if (data.action && data.action.startsWith("calendar_")) {
				if (data.text) {
					setTextMessages((prev) => [
						...prev,
						{ role: "assistant", content: data.text },
					]);
				}

				// Check if this was a conflict error
				if (
					data.actionResult &&
					(data.actionResult.error === "Schedule conflict detected" ||
						data.actionResult.conflict_count > 0)
				) {
					// Refresh events and switch to conflict view
					const updatedEvents = await refreshEvents();
					const updatedConflicts = detectConflicts(updatedEvents);
					if (updatedConflicts.length > 0) {
						setConflicts(updatedConflicts);
						setStage("conflict");
					}
				} else {
					// Refresh events after successful calendar action
					const updatedEvents = await refreshEvents();
					
					// Check if there are now conflicts after the action
					const updatedConflicts = detectConflicts(updatedEvents);
					if (updatedConflicts.length > 0) {
						setConflicts(updatedConflicts);
						setStage("conflict");
					} else if (stage === "conflict") {
						// If we were in conflict view but conflicts are resolved, go back to summary
						setStage("summary");
					}
				}

				if (typeof window !== "undefined") {
					window.dispatchEvent(
						new CustomEvent("miraCalendarUpdated", {
							detail: { action: data.action, result: data.actionResult },
						})
					);
				}
				return;
			}

			if (data.text) {
				setTextMessages((prev) => [
					...prev,
					{ role: "assistant", content: data.text },
				]);
			}
		} catch (error) {
			console.error("Error sending text query:", error);
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

	// Calculate stats
	const totalEvents = events.length;
	const totalMeet = events.filter(
		(e) => e.provider === "google" || e.provider === "meet"
	).length;
	const totalTeams = events.filter(
		(e) => e.provider === "teams" || e.provider === "microsoft"
	).length;
	const nextEventTitle = events[0]?.title || "No upcoming events";

	return (
		<div className="flex flex-col min-h-screen bg-[#F8F8FB] text-gray-800">
			{/* Global Header Bar */}
			<div className="fixed top-0 left-0 w-full bg-[#F8F8FB] pl-[70px] md:pl-[90px] z-40">
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
			<main className="max-sm:mt-6 flex-1 flex flex-col items-center px-2 sm:px-4 md:px-6 pt-20">
				{/* Action buttons */}
				<div className="w-full max-w-[900px] mx-auto mb-4 flex gap-3 justify-end px-4">
					<button
						onClick={() => setStage("add-event")}
						className="px-4 py-2 bg-[#735FF8] text-white rounded-full text-[14px] font-medium hover:bg-[#6350E0] transition flex items-center gap-2"
					>
						<span>+</span> Add Event
					</button>
					<button
						onClick={refreshEvents}
						disabled={isLoadingEvents}
						className="px-4 py-2 border border-gray-300 text-gray-700 rounded-full text-[14px] font-medium hover:bg-gray-50 transition flex items-center gap-2 disabled:opacity-50"
					>
						{isLoadingEvents ? (
							<div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
						) : (
							<span>↻</span>
						)}
						Refresh
					</button>
				</div>

				{/* SCALE CONTAINER */}
				<div className="scale-[0.90] flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
					{/* ORB */}
					<div className="mt-4 relative flex flex-col items-center">
						<div
							className={`w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br 
							from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5]
							shadow-[0_0_80px_15px_rgba(210,180,255,0.45)] ${
								stage === "loading" ? "animate-pulse" : ""
							}`}
						></div>
					</div>

					{/* PANEL */}
					<div className="w-full flex justify-center">
						<div className="w-full max-w-[800px] mx-auto">
							{stage === "loading" && (
								<div className="max-w-[800px] mt-14 bg-[#F8F8FB] rounded-xl">
									<ThinkingPanel />
								</div>
							)}

							{/* All other stages inside SCROLL CONTAINER */}
							{stage !== "loading" && (
								<div className="relative mt-14 w-full max-w-[800px]">
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
									>
										{stage === "summary" && (
											<CalendarSummaryPanel
												events={events}
												totalEvents={totalEvents}
												totalMeet={totalMeet}
												totalTeams={totalTeams}
												nextEventTitle={nextEventTitle}
											/>
										)}

										{stage === "conflict" && (
											<CalendarConflictDetection
												events={events}
												conflicts={conflicts}
												totalEvents={totalEvents}
												totalMeet={totalMeet}
												totalTeams={totalTeams}
												nextEventTitle={nextEventTitle}
												onReschedule={handleReschedule}
												onCancel={handleCancelEvent}
												isLoading={isLoadingEvents}
												externalConflictMessage={externalConflictMessage}
											/>
										)}

										{stage === "rescheduling" && eventToReschedule && (
											<ReschedulingPanel
												eventToReschedule={eventToReschedule}
												availableSlots={availableSlots}
												isLoadingSlots={isLoadingSlots}
												onSelectSlot={handleSelectSlot}
												onConfirmReschedule={handleConfirmReschedule}
												onCancel={() => {
													setEventToReschedule(null);
													setStage(conflicts.length > 0 ? "conflict" : "summary");
												}}
												isRescheduling={isRescheduling}
											/>
										)}

										{stage === "confirmation" && (
											<MeetingConfirmationUI
												events={events}
												rescheduledEvent={rescheduledEvent}
												newTime={newTime}
												actionType={actionType}
												onViewCalendar={() => {}}
												onSuggestOther={handleSuggestOther}
												onDone={handleDone}
											/>
										)}

										{stage === "add-event" && (
											<AddEventPanel
												onSchedule={handleScheduleEvent}
												onCancel={() => {
													setScheduleConflictError(null);
													setStage(conflicts.length > 0 ? "conflict" : "summary");
												}}
												isScheduling={isScheduling}
												conflictError={scheduleConflictError}
											/>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</main>

		<Sidebar />

		{/* FooterBar - Hide when viewing conflict panel */}
		{stage !== "conflict" && (
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
		)}
	</div>
);
}
