/** @format */
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";

export default function OnboardingStep3() {
	const router = useRouter();
	const [connectedEmails, setConnectedEmails] = useState<string[]>([]);
	const [connecting, setConnecting] = useState<string | null>(null);

	// Check for Gmail and Outlook connection status on component mount
	useEffect(() => {
		// Check URL parameters for OAuth callbacks
		const urlParams = new URLSearchParams(window.location.search);
		const gmailConnected = urlParams.get("gmail_connected");
		const gmailAccessToken = urlParams.get("access_token");
		const gmailEmail = urlParams.get("email");
		const msConnected = urlParams.get("ms_connected");
		const msEmail = urlParams.get("email");

		// Handle Gmail callback
		if (gmailConnected === "true" && gmailAccessToken && gmailEmail) {
			// Store Gmail access token
			localStorage.setItem("gmail_access_token", gmailAccessToken);
			localStorage.setItem("gmail_email", gmailEmail);
			
			// Add Gmail to connected emails (but don't auto-save - user must click Save)
			setConnectedEmails(prev => {
				if (!prev.includes("Gmail")) {
					return [...prev, "Gmail"];
				}
				return prev;
			});

			// Clear URL parameters
			window.history.replaceState({}, document.title, window.location.pathname);
			
			// Show success message
			alert(`Gmail connected successfully! Email: ${gmailEmail}`);
		} 
		// Handle Microsoft/Outlook callback
		else if (msConnected === "true" && msEmail) {
			// Note: Microsoft access token is stored in HttpOnly cookie by backend
			// We just mark Outlook as connected locally (but don't auto-save - user must click Save)
			setConnectedEmails(prev => {
				if (!prev.includes("Outlook")) {
					return [...prev, "Outlook"];
				}
				return prev;
			});

			// Clear URL parameters
			window.history.replaceState({}, document.title, window.location.pathname);
			
			// Show success message
			alert(`Outlook connected successfully! Email: ${msEmail}`);
		} else {
			// Check if user has existing connections (indicating successful connection)
			const gmailToken = localStorage.getItem("gmail_access_token");
			if (gmailToken && !connectedEmails.includes("Gmail")) {
				setConnectedEmails(prev => [...prev, "Gmail"]);
			}
			// For Outlook, we can't check localStorage (token in cookie), but we can check if user was redirected here
			// The connection state will be maintained through the onboarding flow
		}
	}, [connectedEmails]);

	const handleGmailConnect = async () => {
		setConnecting("Gmail");
		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			// Pass return_to so settings page redirects back here after OAuth
			window.location.href = `${apiBase}/gmail/auth?return_to=${encodeURIComponent(window.location.href)}`;
		} catch (error) {
			console.error("Error connecting Gmail:", error);
			alert("Failed to connect Gmail. Please try again.");
			setConnecting(null);
		}
	};

	const handleOutlookConnect = async () => {
		setConnecting("Outlook");
		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			// Pass return_to so settings page redirects back here after OAuth
			window.location.href = `${apiBase}/microsoft/auth?return_to=${encodeURIComponent(window.location.href)}`;
		} catch (error) {
			console.error("Error connecting Outlook:", error);
			alert("Failed to connect Outlook. Please try again.");
			setConnecting(null);
		}
	};

	const handleMicrosoft365Connect = async () => {
		setConnecting("Microsoft 365");
		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			// Pass return_to so settings page redirects back here after OAuth
			window.location.href = `${apiBase}/microsoft/auth?return_to=${encodeURIComponent(window.location.href)}`;
		} catch (error) {
			console.error("Error connecting Microsoft 365:", error);
			alert("Failed to connect Microsoft 365. Please try again.");
			setConnecting(null);
		}
	};

	const handleContinue = () => {
		try {
			localStorage.setItem(
				"mira_onboarding_step3",
				JSON.stringify({ connectedEmails })
			);
		} catch {}
		console.log("Connected emails:", connectedEmails);
		router.push("/onboarding/step4");
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Main Content */}
			<main className="flex flex-1 justify-center items-center px-4 md:px-10 overflow-y-auto py-10 md:py-0">
				<div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 md:p-10 w-full max-w-md sm:max-w-lg md:max-w-2xl">
					{/* Header */}
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-xs sm:text-sm text-gray-500">Step 3 of 5</p>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-3/5 transition-all"></div>
					</div>

					{/* Title + Description */}
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 text-center md:text-left">
						Link Your Email
					</h1>
					<p className="text-gray-600 mb-6 text-[14px] sm:text-[15px] text-center md:text-left">
						Connect your email account to get started with Mira
					</p>

					{/* Email Provider Options */}
					<div className="space-y-4">
						{[
							{ 
								icon: <FcGoogle size={22} />, 
								name: "Gmail", 
								onClick: handleGmailConnect,
								connected: connectedEmails.includes("Gmail")
							},
							{
								icon: <FaMicrosoft size={22} color="#0078D4" />,
								name: "Outlook",
								onClick: handleOutlookConnect,
								connected: connectedEmails.includes("Outlook")
							},
							// Microsoft 365 - commented out as it's the same as Outlook
							// {
							// 	icon: <FaMicrosoft size={22} color="#F25022" />,
							// 	name: "Microsoft 365",
							// 	onClick: handleMicrosoft365Connect,
							// 	connected: connectedEmails.includes("Microsoft 365")
							// },
						].map(({ icon, name, onClick, connected }, i) => (
							<div
								key={i}
								className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-300 rounded-lg px-4 py-3 hover:shadow-md transition cursor-pointer"
							>
								<div className="flex items-center gap-3 mb-2 sm:mb-0">
									{icon}
									<p className="font-medium text-gray-800 text-[15px]">
										{name}
									</p>
									{connected && (
										<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
											Connected
										</span>
									)}
								</div>
								<button 
									onClick={onClick}
									disabled={connecting === name || connected}
									className="text-sm text-purple-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{connecting === name ? "Connecting..." : connected ? "Connected" : "Connect"}
								</button>
							</div>
						))}
					</div>

					{/* Continue Button */}
					<button
						onClick={handleContinue}
						className="w-full bg-black text-white py-2.5 mt-6 rounded-full font-medium hover:opacity-90 transition text-sm sm:text-base"
					>
						Continue
					</button>

					<p className="text-center text-gray-500 text-xs sm:text-sm mt-2">
						You can always add more email accounts later
					</p>
				</div>
			</main>

			{/* Bottom Nav (Mobile only) */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around py-3">
				{["Dashboard", "Settings", "Reminder", "Profile"].map((name, i) => (
					<div
						key={i}
						onClick={() => {
							if (name === "Dashboard") router.push("/dashboard");
							else if (name === "Profile") router.push("/dashboard/profile");
							else router.push(`/dashboard/${name.toLowerCase()}`);
						}}
						className="flex flex-col items-center text-gray-700"
					>
						<Icon name={name} size={20} />
					</div>
				))}
			</div>
		</div>
	);
}
