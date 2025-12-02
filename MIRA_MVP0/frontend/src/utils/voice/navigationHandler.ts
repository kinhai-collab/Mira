/** @format */

/**
 * Voice Navigation Handler
 * Handles voice commands for dashboard navigation
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectIntent } from "@/utils/voice/intents";

/**
 * Hook to handle voice navigation commands
 * Use this in any dashboard page to enable voice navigation
 */
export function useVoiceNavigation() {
	const router = useRouter();

	useEffect(() => {
		const handler = (event: Event) => {
			const customEvent = event as CustomEvent<{
				route: string;
				destination: string;
			}>;
			const detail = customEvent.detail || {};

			if (detail.route) {
				router.push(detail.route);
			}
		};

		if (typeof window !== "undefined") {
			window.addEventListener(
				"miraDashboardNavigate",
				handler as EventListener
			);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"miraDashboardNavigate",
					handler as EventListener
				);
			}
		};
	}, [router]);

	useEffect(() => {
		/** 1. Handle raw transcript text */
		const transcriptHandler = (event: Event) => {
			const customEvent = event as CustomEvent<{ text: string }>;
			const text = customEvent.detail?.text;
			console.log("Event received:", event);
			console.log("Transcript:", text);
			if (!text) return;

			// correct
			const parsed = detectIntent(text);

			switch (parsed.intent) {
				case "SHOW_CALENDAR":
					router.push("/scenarios/smart-summary");
					return;

				case "SHOW_EMAILS":
					router.push("/scenarios/smart-summary?focus=emails");
					return;

				case "SHOW_EMAILS_AND_CALENDAR":
					router.push("/scenarios/smart-summary");
					return;

				case "SHOW_MORNING_BRIEF":
					router.push("/scenarios/morning-brief");
					return;

				case "GO_TO_DASHBOARD":
					router.push("/dashboard");
					return;

				case "GO_HOME":
					router.push("/");
					return;
				case "CALENDAR_SCHEDULE":
					router.push("/scenarios/smart-scheduling?scheduleMode=new");
					return;

				case "CALENDAR_RESCHEDULE":
					router.push("/scenarios/smart-scheduling?scheduleMode=reschedule");
					return;
			}
		};

		/** 2. Handle direct route navigation */
		const directHandler = (event: Event) => {
			const customEvent = event as CustomEvent<{ route: string }>;
			const route = customEvent.detail?.route;
			if (route) router.push(route);
		};

		window.addEventListener("miraTranscriptFinal", transcriptHandler);
		window.addEventListener("miraDashboardNavigate", directHandler);

		return () => {
			window.removeEventListener("miraTranscriptFinal", transcriptHandler);
			window.removeEventListener("miraDashboardNavigate", directHandler);
		};
	}, [router]);
}

/**
 * Available voice navigation commands:
 *
 * - "Show mail list" | "Open emails" | "Go to inbox" → /dashboard/emails
 * - "Show calendar" | "Open my calendar" | "Go to schedule" → /dashboard/calendar
 * - "Open settings" | "Go to settings" → /dashboard/settings
 * - "Show reminders" | "Open tasks" → /dashboard/remainder
 * - "Show profile" | "Open my account" → /dashboard/profile
 * - "Go to homepage" | "Open homepage" → / (actual home page with Mira)
 * - "Go to dashboard" | "Back to dashboard" → /dashboard
 */

/** @format */
