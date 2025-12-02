/** @format */

export function detectIntent(text: string) {
	const t = text.toLowerCase();

	if (t.includes("show me my calendar") || t.includes("calendar events"))
		return { intent: "SHOW_CALENDAR" };

	if (t.includes("show me my emails")) return { intent: "SHOW_EMAILS" };

	if (
		t.includes("show me my emails and calendar") ||
		t.includes("email and calendar")
	)
		return { intent: "SHOW_EMAILS_AND_CALENDAR" };

	if (t.includes("show me my morning brief") || t.includes("morning brief"))
		return { intent: "SHOW_MORNING_BRIEF" };

	if (t.includes("go to the dashboard") || t.includes("open dashboard"))
		return { intent: "GO_TO_DASHBOARD" };

	if (t.includes("go back home") || t.includes("home page"))
		return { intent: "GO_HOME" };

	return { intent: "NONE" };
}
