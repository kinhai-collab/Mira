/** @format */

export function detectIntent(text: string) {
	const t = text.toLowerCase();

	if (t.includes("show me my calendar") || t.includes("calendar events"))
		return { intent: "SHOW_CALENDAR" };

	if (t.includes("show me my emails")) return { intent: "SHOW_EMAILS" };
	// ================== CALENDAR SCHEDULING ==================
	if (
		t.includes("schedule a meeting") ||
		t.includes("book a meeting") ||
		t.includes("set a meeting") ||
		t.includes("add an event") ||
		t.includes("create an event")
	) {
		return { intent: "CALENDAR_SCHEDULE" };
	}

	// ================== RESCHEDULING ==================
	if (
		t.includes("reschedule") ||
		t.includes("move my meeting") ||
		t.includes("change my meeting") ||
		t.includes("shift my meeting")
	) {
		return { intent: "CALENDAR_RESCHEDULE" };
	}

	if (
		t.includes("show me my emails and calendar") ||
		t.includes("email and calendar")
	)
		return { intent: "SHOW_EMAILS_AND_CALENDAR" };

	// ----------------- MORNING BRIEF -----------------
	if (
		t.includes("morning brief") ||
		t.includes("my morning brief") ||
		t.includes("show me my morning brief") ||
		t.includes("give me my morning brief") ||
		t.includes("today's brief") ||
		t.includes("how's my morning")
	) {
		return { intent: "SHOW_MORNING_BRIEF" };
	}

	if (t.includes("go to the dashboard") || t.includes("open dashboard"))
		return { intent: "GO_TO_DASHBOARD" };

	if (t.includes("go back home") || t.includes("home page"))
		return { intent: "GO_HOME" };

	return { intent: "NONE" };
}
