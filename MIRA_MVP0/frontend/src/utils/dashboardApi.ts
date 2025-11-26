/** @format */

/**
 * Dashboard API utility functions for fetching Gmail and Calendar data
 */

import { getValidToken } from "./auth";

const API_BASE_URL = (
	process.env.NEXT_PUBLIC_API_URL ||
	"https://xmtg107ehj.execute-api.us-east-2.amazonaws.com"
).replace(/\/$/, "");

const buildApiUrl = (path: string) => {
	const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
	return `${API_BASE_URL}/${normalizedPath}`;
};

export interface EmailStats {
	total_important: number;
	unread: number;
	priority_distribution: {
		high: number;
		medium: number;
		low: number;
	};
	top_sender: string;
	trend: number;
	timeframe?: string;
}

export interface NextEvent {
	summary: string;
	start: string;
	duration: number;
	location?: string;
	conference_data?: {
		url?: string;
		type?: string;
	};
	attendees_count: number;
	provider?: "google" | "outlook";  // ✅ Add provider field
}

export interface CalendarEvent {
	id: string;
	title: string;
	timeRange: string;
    start?: string; // ISO string
    end?: string;   // ISO string
	location?: string;
	note?: string | null;
	meetingLink?: string | null;
	provider?: string | null;  // Meeting provider (teams, meet, zoom)
	calendar_provider?: "google" | "outlook";  // ✅ Calendar provider (google/outlook)
}

export interface EventStats {
	total_events: number;
	total_hours: number;
	rsvp_pending: number;
	next_event: NextEvent | null;
	busy_level: "light" | "moderate" | "busy";
	deep_work_blocks: number;
	at_risk_tasks: number;
	events?: CalendarEvent[];
}

export interface DashboardSummary {
	emails: EmailStats;
	events: EventStats;
	last_updated: string;
}

interface ApiResponse<T> {
	status: string;
	message?: string;
	data: T;
}

/**
 * Fetch email statistics from Gmail
 */
export async function fetchEmailStats(): Promise<EmailStats> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return {
				total_important: 0,
				unread: 0,
				priority_distribution: { high: 0, medium: 0, low: 0 },
				top_sender: "Not logged in",
				trend: 0,
			};
		}

		const endpoint = buildApiUrl("dashboard/emails");
		console.log("Fetching email stats from:", endpoint);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",  // ✅ Include cookies for Outlook token
		});

		console.log("Email stats response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`Failed to fetch email stats: ${response.statusText}`,
				errorText
			);
			throw new Error(`Failed to fetch email stats: ${response.statusText}`);
		}

		const result: ApiResponse<EmailStats> = await response.json();
		console.log("Email stats result:", result);

		if (result.status === "not_connected") {
			// Return default values if Gmail not connected
			return {
				total_important: 0,
				unread: 0,
				priority_distribution: { high: 0, medium: 0, low: 0 },
				top_sender: "Gmail not connected",
				trend: 0,
			};
		}

		return result.data;
	} catch (error) {
		console.error("Error fetching email stats:", error);
		// Return default values on error
		return {
			total_important: 0,
			unread: 0,
			priority_distribution: { high: 0, medium: 0, low: 0 },
			top_sender: "Error loading",
			trend: 0,
		};
	}
}

/**
 * Fetch event statistics from Google Calendar
 */
export async function fetchEventStats(): Promise<EventStats> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return {
				total_events: 0,
				total_hours: 0,
				rsvp_pending: 0,
				next_event: null,
				busy_level: "light",
				deep_work_blocks: 0,
				at_risk_tasks: 0,
			};
		}

		const endpoint = buildApiUrl("dashboard/events");
		console.log("Fetching event stats from:", endpoint);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",  // ✅ Include cookies for Outlook token
		});

		console.log("Event stats response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`Failed to fetch event stats: ${response.statusText}`,
				errorText
			);
			throw new Error(`Failed to fetch event stats: ${response.statusText}`);
		}

		const result: ApiResponse<EventStats> = await response.json();
		console.log("Event stats result:", result);

		if (result.status === "not_connected") {
			// Return default values if Calendar not connected
			return {
				total_events: 0,
				total_hours: 0,
				rsvp_pending: 0,
				next_event: null,
				busy_level: "light",
				deep_work_blocks: 0,
				at_risk_tasks: 0,
			};
		}

		return result.data;
	} catch (error) {
		console.error("Error fetching event stats:", error);
		// Return default values on error
		return {
			total_events: 0,
			total_hours: 0,
			rsvp_pending: 0,
			next_event: null,
			busy_level: "light",
			deep_work_blocks: 0,
			at_risk_tasks: 0,
		};
	}
}

/**
 * Fetch complete dashboard summary (emails + events)
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
	try {
		const token = await getValidToken();
		if (!token) {
			throw new Error("No authentication token available");
		}

		const endpoint = buildApiUrl("dashboard/summary");

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",  // ✅ Include cookies for Outlook token
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch dashboard summary: ${response.statusText}`
			);
		}

		const result: ApiResponse<DashboardSummary> = await response.json();
		return result.data;
	} catch (error) {
		console.error("Error fetching dashboard summary:", error);
		// Return default values on error
		const [emails, events] = await Promise.all([
			fetchEmailStats(),
			fetchEventStats(),
		]);

		return {
			emails,
			events,
			last_updated: new Date().toISOString(),
		};
	}
}

/**
 * Format time for display (e.g., "9:00 AM")
 */
export function formatEventTime(isoString: string): string {
	try {
		const date = new Date(isoString);
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	} catch {
		return "";
	}
}

/**
 * Format duration (e.g., "15min", "1h 30min")
 */
export function formatDuration(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}min`;
	}

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	if (mins === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${mins}min`;
}

// Task interfaces
export interface Task {
	id: string;
	title: string;
	due_date: string | null;
	priority: "high" | "medium" | "low";
	status: "pending" | "in_progress" | "completed" | "cancelled";
	source?: "google" | "mira"; // Where the task comes from
	task_list_name?: string; // For Google Tasks
}

export interface TaskStats {
	total_tasks: number;
	overdue: number;
	due_today: number;
	upcoming: number;
	next_tasks: Task[];
}

// Reminder interfaces
export interface Reminder {
	id: string;
	title: string;
	reminder_time: string;
	repeat_type: "none" | "daily" | "weekly" | "monthly";
}

export interface ReminderStats {
	total_reminders: number;
	overdue: number;
	due_today: number;
	upcoming: number;
	next_reminders: Reminder[];
}


export interface EventListData {
	events: CalendarEvent[];
	providers: string[];
}

/**
 * Fetch detailed list of events from Calendar
 */
export async function fetchEventList(
	startDate?: Date,
	endDate?: Date,
	days: number = 7
): Promise<EventListData> {
	try {
		const token = await getValidToken();
		if (!token) {
			return { events: [], providers: [] };
		}

		const endpoint = buildApiUrl("dashboard/events/list");
		let query = `?days=${days}`;
		if (startDate) query += `&start_date=${startDate.toISOString()}`;
		if (endDate) query += `&end_date=${endDate.toISOString()}`;

		const response = await fetch(endpoint + query, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch event list: ${response.statusText}`);
		}

		const result = await response.json();
		return result.data;
	} catch (error) {
		console.error("Error fetching event list:", error);
		return { events: [], providers: [] };
	}
}

/**
 * Create a new event
 */
export async function createEvent(eventData: {
	summary: string;
	start: string;
	end: string;
	description?: string;
	location?: string;
	attendees?: string[];
}) {
	const token = await getValidToken();
	if (!token) throw new Error("No auth token");

	const endpoint = buildApiUrl("api/assistant/calendar/schedule");
	console.log("Creating event at:", endpoint, "with data:", eventData);

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		credentials: "include", // Include cookies for Outlook token
		body: JSON.stringify(eventData),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Failed to create event:", response.status, errorText);
		throw new Error(`Failed to create event: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Fetch task statistics from both Google Tasks and MIRA
 */
export async function fetchTaskStats(): Promise<TaskStats> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return {
				total_tasks: 0,
				overdue: 0,
				due_today: 0,
				upcoming: 0,
				next_tasks: [],
			};
		}

		const endpoint = buildApiUrl("dashboard/tasks");
		console.log("Fetching task stats from:", endpoint);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",  // ✅ Include cookies for Outlook token
		});

		console.log("Task stats response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`Failed to fetch task stats: ${response.statusText}`,
				errorText
			);
			throw new Error(`Failed to fetch task stats: ${response.statusText}`);
		}

		const result: ApiResponse<TaskStats> = await response.json();
		console.log("Task stats result:", result);

		return result.data;
	} catch (error) {
		console.error("Error fetching task stats:", error);
		return {
			total_tasks: 0,
			overdue: 0,
			due_today: 0,
			upcoming: 0,
			next_tasks: [],
		};
	}
}

/**
 * Fetch reminder statistics from Supabase
 */
export async function fetchReminderStats(): Promise<ReminderStats> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return {
				total_reminders: 0,
				overdue: 0,
				due_today: 0,
				upcoming: 0,
				next_reminders: [],
			};
		}

		const endpoint = buildApiUrl("dashboard/reminders");
		console.log("Fetching reminder stats from:", endpoint);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			credentials: "include",  // ✅ Include cookies for Outlook token
		});

		console.log("Reminder stats response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`Failed to fetch reminder stats: ${response.statusText}`,
				errorText
			);
			throw new Error(`Failed to fetch reminder stats: ${response.statusText}`);
		}

		const result: ApiResponse<ReminderStats> = await response.json();
		console.log("Reminder stats result:", result);

		return result.data;
	} catch (error) {
		console.error("Error fetching reminder stats:", error);
		return {
			total_reminders: 0,
			overdue: 0,
			due_today: 0,
			upcoming: 0,
			next_reminders: [],
		};
	}
}

/**
 * Format task due date for display
 */
export function formatTaskDueDate(dueDate: string | null): string {
	if (!dueDate) return "No due date";

	try {
		const date = new Date(dueDate);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const taskDate = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate()
		);

		const diffTime = taskDate.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})}`;
		} else if (diffDays === 1) {
			return `Tomorrow, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})}`;
		} else if (diffDays === -1) {
			return "Yesterday";
		} else if (diffDays < 0) {
			return `${Math.abs(diffDays)} days overdue`;
		} else if (diffDays < 7) {
			return `${date.toLocaleDateString("en-US", {
				weekday: "short",
			})}, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})}`;
		} else {
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			});
		}
	} catch (error) {
		console.error("Error formatting task due date:", error);
		return "Invalid date";
	}
}

/**
 * Format reminder time for display
 */
export function formatReminderTime(reminderTime: string): string {
	try {
		const date = new Date(reminderTime);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const reminderDate = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate()
		);

		const diffTime = reminderDate.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})}`;
		} else if (diffDays === 1) {
			return `Tomorrow, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})}`;
		} else if (diffDays === -1) {
			return "Yesterday";
		} else if (diffDays < 7) {
			return `${date.toLocaleDateString("en-US", {
				weekday: "short",
			})}, ${date.toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})}`;
		} else {
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
		}
	} catch (error) {
		console.error("Error formatting reminder time:", error);
		return "Invalid time";
	}
}

// Email list interface
export interface Email {
	id: string;
	sender_name: string;
	sender_email: string;
	subject: string;
	snippet: string;
	body: string;
	summary?: string;
	priority: "high" | "medium" | "low";
	time_ago: string;
	timestamp: string;
	is_unread: boolean;
	labels: string[];
	provider: "gmail" | "outlook";  // ✅ Added provider field
}

export interface EmailListData {
	emails: Email[];
	total_count: number;
}

/**
 * Fetch detailed list of emails
 */
export async function fetchEmailList(
	maxResults: number = 50,
	daysBack: number = 7
): Promise<EmailListData> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return {
				emails: [],
				total_count: 0,
			};
		}

		const endpoint = buildApiUrl("dashboard/emails/list");
		console.log("Fetching email list from:", endpoint);

		const response = await fetch(
			`${endpoint}?max_results=${maxResults}&days_back=${daysBack}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				credentials: "include",  // ✅ Include cookies for Outlook token
			}
		);

		console.log("Email list response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(
				`Failed to fetch email list: ${response.statusText}`,
				errorText
			);
			throw new Error(`Failed to fetch email list: ${response.statusText}`);
		}

		const result: ApiResponse<EmailListData> = await response.json();
		console.log("Email list result:", result);

		if (result.status === "not_connected") {
			// Return empty list if Gmail not connected
			return {
				emails: [],
				total_count: 0,
			};
		}

		return result.data;
	} catch (error) {
		console.error("Error fetching email list:", error);
		return {
			emails: [],
			total_count: 0,
		};
	}
}
export async function fetchEmailSummary(emailId: string): Promise<{status: string, email_id: string, summary: string} | null> {
	try {
		const token = await getValidToken();
		if (!token) {
			console.error("No authentication token available");
			return null;
		}

		const endpoint = buildApiUrl(`dashboard/emails/summary/${emailId}`);
		console.log("Fetching email summary from:", endpoint);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		console.log("Email summary response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Failed to fetch email summary: ${response.statusText}`, errorText);
			throw new Error(`Failed to fetch email summary: ${response.statusText}`);
		}

		const result = await response.json();
		console.log("Email summary result:", result);

		return result;
	} catch (error) {
		console.error("Error fetching email summary:", error);
		return null;
	}
}
