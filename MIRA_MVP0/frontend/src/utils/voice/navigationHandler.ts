/** @format */

/**
 * Voice Navigation Handler
 * Handles voice commands for dashboard navigation
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to handle voice navigation commands
 * Use this in any dashboard page to enable voice navigation
 */
export function useVoiceNavigation() {
	const router = useRouter();

	useEffect(() => {
		const handler = (event: Event) => {
			const customEvent = event as CustomEvent<{ route: string; destination: string }>;
			const detail = customEvent.detail || {};
			
			if (detail.route) {
				console.log("🧭 Voice navigation command received:", detail.route);
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

