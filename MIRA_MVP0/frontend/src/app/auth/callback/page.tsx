/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTokenFromUrl, storeAuthToken } from "@/utils/auth";

export default function AuthCallback() {
	const router = useRouter();
	const [status, setStatus] = useState("Processing authentication...");

	useEffect(() => {
		const handleAuthCallback = async () => {
			try {
				// Extract token from URL fragment
				const accessToken = extractTokenFromUrl();
				
				if (accessToken) {
					setStatus("Storing authentication data...");
					
					// Store the token and user data
					storeAuthToken(accessToken);
					
					// Dispatch event to notify components of user data update
					window.dispatchEvent(new CustomEvent('userDataUpdated'));
					
					setStatus("Authentication successful! Redirecting...");
					
					// Small delay to show success message
					setTimeout(() => {
						router.push("/dashboard");
					}, 1000);
				} else {
					setStatus("No authentication token found. Redirecting to login...");
					
					// Check if there are any error parameters in the URL
					const urlParams = new URLSearchParams(window.location.search);
					const error = urlParams.get('error');
					const errorDescription = urlParams.get('error_description');
					
					if (error) {
						console.error("OAuth error:", error, errorDescription);
						setStatus(`Authentication failed: ${errorDescription || error}`);
					}
					
					setTimeout(() => {
						router.push("/login");
					}, 2000);
				}
			} catch (error) {
				console.error("Error during authentication callback:", error);
				setStatus("Authentication failed. Redirecting to login...");
				setTimeout(() => {
					router.push("/login");
				}, 2000);
			}
		};

		handleAuthCallback();
	}, [router]);

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8]">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<p className="text-gray-600">{status}</p>
			</div>
		</div>
	);
}
