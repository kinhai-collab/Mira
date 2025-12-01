/** @format */

// frontend/src/hooks/useMiraText.ts
"use client";

import { useRouter } from "next/navigation";

export function useMiraText() {
	const router = useRouter();

	async function submitTextQuery(query: string) {
		if (!query.trim()) return;

		try {
			// Load token dynamically
			const { getValidToken } = await import("@/utils/auth");
			const token = await getValidToken();

			// Build URL cleanly
			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");

			// Send text to backend
			const response = await fetch(`${apiBase}/api/text-query`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: "include",
				body: JSON.stringify({ query, history: [] }),
			});

			const data = await response.json();

			// Interpret action
			handleMiraAction(data);
		} catch (err) {
			console.error("Text query error:", err);
		}
	}

	/* ------------------------------
     ACTION INTERPRETER
  ------------------------------ */
	function handleMiraAction(data: any) {
		if (!data) return;

		// 1. NAVIGATION ACTIONS
		if (data.action === "navigate" && data.actionTarget) {
			router.push(data.actionTarget);
			return;
		}

		if (data.action === "open_smart_summary") {
			router.push("/scenarios/smart-summary");
			return;
		}

		if (data.action === "open_morning_brief") {
			router.push("/scenarios/morning-brief");
			return;
		}

		if (data.action === "open_scheduling") {
			router.push("/scenarios/smart-scheduling");
			return;
		}

		// 2. EVENT DISPATCH ACTIONS (page-specific)
		if (data.action === "email_calendar_summary") {
			window.dispatchEvent(
				new CustomEvent("miraEmailCalendarSummary", {
					detail: data.actionData,
				})
			);
			return;
		}

		if (data.action === "morning_brief_ready") {
			window.dispatchEvent(
				new CustomEvent("miraBriefData", {
					detail: data.actionData,
				})
			);
			return;
		}

		if (data.action === "scheduling_flow") {
			window.dispatchEvent(
				new CustomEvent("miraSchedulingFlow", {
					detail: data.actionData,
				})
			);
			return;
		}

		console.log("No matching Mira action:", data);
	}

	return { submitTextQuery };
}
