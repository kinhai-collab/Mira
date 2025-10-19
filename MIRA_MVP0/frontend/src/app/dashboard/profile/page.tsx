/** @format */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/utils/auth";

export default function Profile() {
	const router = useRouter();

	// Check authentication on mount
	useEffect(() => {
		if (!isAuthenticated()) {
			router.push('/login');
			return;
		}
	}, [router]);

	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold mb-2">Profile</h1>
			<p className="text-gray-600">Your profile page.</p>
		</div>
	);
}
