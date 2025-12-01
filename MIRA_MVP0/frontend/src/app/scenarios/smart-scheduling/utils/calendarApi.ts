/** @format */

/**
 * Calendar API utilities for smart-scheduling page
 * Handles event fetching, conflict detection, scheduling, rescheduling, and canceling
 */

import { getValidToken } from "@/utils/auth";

const API_BASE_URL = (
	process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const buildApiUrl = (path: string) => {
	const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
	return `${API_BASE_URL}/${normalizedPath}`;
};

// Types
export interface CalendarEvent {
	id: string;
	summary: string;
	start: {
		dateTime?: string;
		date?: string;
	};
	end: {
		dateTime?: string;
		date?: string;
	};
	attendees?: Array<{ email: string; displayName?: string }>;
	location?: string;
	description?: string;
	_provider?: "google" | "outlook";
}

export interface ConflictResult {
	has_conflict: boolean;
	conflicts: CalendarEvent[];
}

export interface ScheduleResult {
	status: string;
	event?: CalendarEvent;
	has_conflict: boolean;
}

export interface ConflictDetails {
	summary: string;
	start: string;
	end: string;
	provider: string;
	calendar: string;
}

export interface ScheduleConflictError {
	error: string;
	message: string;
	conflicts: ConflictDetails[];
	conflict_count: number;
	google_conflicts: number;
	outlook_conflicts: number;
}

/**
 * Fetch events for a time window from both Google Calendar and Outlook
 */
export async function fetchEventsForWindow(
	start: Date,
	end: Date
): Promise<CalendarEvent[]> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return [];
		}

		// Fetch from dashboard events list API which returns both Google and Outlook events
		const days = Math.ceil(
			(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
		);
		const endpoint = buildApiUrl(
			`dashboard/events/list?start_date=${start.toISOString()}&end_date=${end.toISOString()}&days=${days}`
		);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",
		});

		if (!response.ok) {
			console.error("Failed to fetch events:", response.statusText);
			return [];
		}

		const result = await response.json();
		// Transform the events to our format
		const events = (result.data?.events || []).map((e: any) => ({
			id: e.id,
			summary: e.title,
			start: { dateTime: e.start },
			end: { dateTime: e.end },
			location: e.location,
			_provider: e.calendar_provider || "google",
		}));

		return events;
	} catch (error) {
		console.error("Error fetching events:", error);
		return [];
	}
}

/**
 * Check for conflicts in a time window
 */
export async function checkConflicts(
	start: Date,
	end: Date
): Promise<ConflictResult> {
	try {
		const token = await getValidToken();
		if (!token) {
			throw new Error("No authentication token");
		}

		const endpoint = buildApiUrl("api/assistant/calendar/check-conflicts");

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify({
				start: start.toISOString(),
				end: end.toISOString(),
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Failed to check conflicts:", errorText);
			throw new Error(`Failed to check conflicts: ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error("Error checking conflicts:", error);
		return { has_conflict: false, conflicts: [] };
	}
}

/**
 * Schedule a new event
 */
export async function scheduleEvent(eventData: {
	summary: string;
	start: Date;
	end: Date;
	description?: string;
	location?: string;
	attendees?: string[];
}): Promise<{ success: boolean; event?: CalendarEvent; error?: ScheduleConflictError }> {
	try {
		const token = await getValidToken();
		if (!token) {
			throw new Error("No authentication token");
		}

		const endpoint = buildApiUrl("api/assistant/calendar/schedule");

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify({
				summary: eventData.summary,
				start: eventData.start.toISOString(),
				end: eventData.end.toISOString(),
				description: eventData.description,
				location: eventData.location,
				attendees: eventData.attendees || [],
			}),
		});

		if (!response.ok) {
			if (response.status === 409) {
				// Conflict error
				const errorData = await response.json();
				return { success: false, error: errorData.detail };
			}
			const errorText = await response.text();
			console.error("Failed to schedule event:", errorText);
			throw new Error(`Failed to schedule event: ${response.statusText}`);
		}

		const result = await response.json();
		return { success: true, event: result.event };
	} catch (error) {
		console.error("Error scheduling event:", error);
		return { success: false };
	}
}

/**
 * Reschedule an existing event
 */
export async function rescheduleEvent(params: {
	eventId?: string;
	oldStart?: Date;
	summary?: string;
	newStart: Date;
	newEnd: Date;
}): Promise<{ success: boolean; event?: CalendarEvent; error?: ScheduleConflictError }> {
	try {
		const token = await getValidToken();
		if (!token) {
			throw new Error("No authentication token");
		}

		const endpoint = buildApiUrl("api/assistant/calendar/reschedule");

		const body: any = {
			new_start: params.newStart.toISOString(),
			new_end: params.newEnd.toISOString(),
		};

		if (params.eventId) {
			body.event_id = params.eventId;
		}
		if (params.oldStart) {
			body.old_start = params.oldStart.toISOString();
		}
		if (params.summary) {
			body.summary = params.summary;
		}

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			if (response.status === 409) {
				// Conflict error
				const errorData = await response.json();
				return { success: false, error: errorData.detail };
			}
			const errorText = await response.text();
			console.error("Failed to reschedule event:", errorText);
			throw new Error(`Failed to reschedule event: ${response.statusText}`);
		}

		const result = await response.json();
		return { success: true, event: result.event };
	} catch (error) {
		console.error("Error rescheduling event:", error);
		return { success: false };
	}
}

/**
 * Cancel an event
 */
export async function cancelEvent(params: {
	eventId?: string;
	start?: Date;
	summary?: string;
}): Promise<{ success: boolean; eventId?: string }> {
	try {
		const token = await getValidToken();
		if (!token) {
			throw new Error("No authentication token");
		}

		const endpoint = buildApiUrl("api/assistant/calendar/cancel");

		const body: any = {};
		if (params.eventId) {
			body.event_id = params.eventId;
		}
		if (params.start) {
			body.start = params.start.toISOString();
		}
		if (params.summary) {
			body.summary = params.summary;
		}

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Failed to cancel event:", errorText);
			throw new Error(`Failed to cancel event: ${response.statusText}`);
		}

		const result = await response.json();
		return { success: true, eventId: result.event_id };
	} catch (error) {
		console.error("Error canceling event:", error);
		return { success: false };
	}
}

/**
 * Find available time slots for a given duration
 */
export async function findAvailableSlots(
	date: Date,
	durationMinutes: number,
	workdayStart: number = 9, // 9 AM
	workdayEnd: number = 18 // 6 PM
): Promise<Array<{ start: Date; end: Date }>> {
	// Get events for the day
	const dayStart = new Date(date);
	dayStart.setHours(workdayStart, 0, 0, 0);

	const dayEnd = new Date(date);
	dayEnd.setHours(workdayEnd, 0, 0, 0);

	const events = await fetchEventsForWindow(dayStart, dayEnd);

	// Sort events by start time
	const sortedEvents = events
		.filter((e) => e.start.dateTime)
		.map((e) => ({
			start: new Date(e.start.dateTime!),
			end: new Date(e.end.dateTime!),
		}))
		.sort((a, b) => a.start.getTime() - b.start.getTime());

	// Find gaps between events
	const availableSlots: Array<{ start: Date; end: Date }> = [];
	let currentTime = dayStart;

	for (const event of sortedEvents) {
		// Gap before this event
		if (currentTime < event.start) {
			const gapMinutes =
				(event.start.getTime() - currentTime.getTime()) / (1000 * 60);
			
			// Generate multiple slots in this gap (every 30 minutes)
			let slotStart = new Date(currentTime);
			while (slotStart.getTime() + durationMinutes * 60 * 1000 <= event.start.getTime()) {
				const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
				availableSlots.push({
					start: new Date(slotStart),
					end: slotEnd,
				});
				// Move to next slot (30 minute intervals)
				slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
			}
		}
		// Move current time to end of this event
		if (event.end > currentTime) {
			currentTime = event.end;
		}
	}

	// Check gap after last event until end of day
	if (currentTime < dayEnd) {
		// Generate multiple slots until end of day (every 30 minutes)
		let slotStart = new Date(currentTime);
		while (slotStart.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
			const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
			availableSlots.push({
				start: new Date(slotStart),
				end: slotEnd,
			});
			// Move to next slot (30 minute intervals)
			slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
		}
	}

	return availableSlots;
}

/**
 * Format time for display
 */
export function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

/**
 * Format time range for display
 */
export function formatTimeRange(start: Date, end: Date): string {
	return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Parse event time string to Date
 */
export function parseEventTime(timeStr: string): Date | null {
	if (!timeStr) return null;
	try {
		return new Date(timeStr);
	} catch {
		return null;
	}
}

