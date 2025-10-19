/** @format */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { extractTokenFromUrl, storeAuthToken } from "@/utils/auth";

export default function AuthCallback() {
	const router = useRouter();

	useEffect(() => {
		// Extract token from URL fragment
		const accessToken = extractTokenFromUrl();
		
		if (accessToken) {
			// Store the token and user data
			storeAuthToken(accessToken);
			
			// Redirect to dashboard
			router.push("/dashboard");
		} else {
			// No token found, redirect to login
			router.push("/login");
		}
	}, [router]);

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8]">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<p className="text-gray-600">Completing authentication...</p>
			</div>
		</div>
	);
}
