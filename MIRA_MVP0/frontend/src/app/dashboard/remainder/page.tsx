/** @format */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/utils/auth";

export default function ReminderPage() {
	const router = useRouter();

	// Check authentication on mount
	useEffect(() => {
		if (!isAuthenticated()) {
			router.push('/login');
			return;
		}
	}, [router]);

	return (
		<div className="flex items-center justify-center h-screen text-gray-700 text-lg font-medium">
			Reminder Page (Coming soon)
		</div>
	);
}
