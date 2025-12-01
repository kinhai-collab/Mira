/** @format */

export interface EventItem {
	id: string;
	title: string;
	time: string; // "4 pm - 5 pm"
	attendee: string;
	provider: string;
	// Extended properties for real data
	startDate?: Date;
	endDate?: Date;
	location?: string;
	description?: string;
	calendarProvider?: "google" | "outlook";
	isConflict?: boolean;
}

export interface ConflictInfo {
	eventA: EventItem;
	eventB: EventItem;
	overlapStart: Date;
	overlapEnd: Date;
}

export interface SchedulingState {
	stage: "loading" | "summary" | "conflict" | "rescheduling" | "confirmation" | "add-event";
	events: EventItem[];
	conflicts: ConflictInfo[];
	selectedConflict: ConflictInfo | null;
	selectedSlot: { start: Date; end: Date } | null;
	rescheduledEvent: EventItem | null;
	newEventData: {
		summary: string;
		start: Date | null;
		end: Date | null;
		attendees: string[];
		location?: string;
		description?: string;
	} | null;
	error: string | null;
	successMessage: string | null;
}

export type SchedulingAction =
	| { type: "SET_STAGE"; stage: SchedulingState["stage"] }
	| { type: "SET_EVENTS"; events: EventItem[] }
	| { type: "SET_CONFLICTS"; conflicts: ConflictInfo[] }
	| { type: "SELECT_CONFLICT"; conflict: ConflictInfo | null }
	| { type: "SELECT_SLOT"; slot: { start: Date; end: Date } | null }
	| { type: "SET_RESCHEDULED_EVENT"; event: EventItem | null }
	| { type: "SET_NEW_EVENT_DATA"; data: SchedulingState["newEventData"] }
	| { type: "SET_ERROR"; error: string | null }
	| { type: "SET_SUCCESS"; message: string | null }
	| { type: "RESET" };
