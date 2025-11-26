/** @format */
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";
import { RiExchangeBoxFill } from "react-icons/ri";

export default function OnboardingStep4() {
	const router = useRouter();
	const [connectedCalendars, setConnectedCalendars] = useState<string[]>([]);
	const [connecting, setConnecting] = useState<string | null>(null);
	const [hasAutoConnected, setHasAutoConnected] = useState(false); // Track if we've already tried auto-connect

	// Check for Google Calendar and Outlook Calendar connection status on component mount
	useEffect(() => {
		const checkConnectionStatus = async () => {
			const urlParams = new URLSearchParams(window.location.search);
			const calendarConnected = urlParams.get("calendar");
			const calendarStatus = urlParams.get("status");
			const msConnected = urlParams.get("ms_connected");
			const msEmail = urlParams.get("email");

			// Handle Google Calendar callback FIRST (before auto-connect logic)
			if (calendarConnected === "google" && calendarStatus === "connected") {
				setConnectedCalendars(prev => {
					if (!prev.includes("Google Calendar")) {
						return [...prev, "Google Calendar"];
					}
					return prev;
				});

				// Clear URL parameters (including return_to)
				window.history.replaceState({}, document.title, window.location.pathname);
				
				// Mark that we've handled the callback, so auto-connect won't run
				setHasAutoConnected(true);
				
				alert("Google Calendar connected successfully!");
				return; // Exit early - don't run auto-connect logic
			}
			// Handle Outlook Calendar callback (same Microsoft OAuth, but we'll check if we're on calendar step)
			else if (msConnected === "true" && msEmail) {
				setConnectedCalendars(prev => {
					if (!prev.includes("Outlook Calendar")) {
						return [...prev, "Outlook Calendar"];
					}
					return prev;
				});

				// Clear URL parameters
				window.history.replaceState({}, document.title, window.location.pathname);
				
				alert(`Outlook Calendar connected successfully! Email: ${msEmail}`);
				return; // Exit early
			}
			
			// Check if Google Calendar is already connected via backend
			try {
				const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
				const token = localStorage.getItem("access_token") || localStorage.getItem("token");
				if (token) {
					const settingsRes = await fetch(`${apiBase}/user_settings`, {
						headers: {
							'Authorization': `Bearer ${token}`,
							'Content-Type': 'application/json'
						},
						credentials: 'include'
					});
					
					if (settingsRes.ok) {
						const settingsResult = await settingsRes.json();
						if (settingsResult?.status === 'success' && settingsResult?.data) {
							const connectedCals = settingsResult.data.connectedCalendars || [];
							if (connectedCals.includes("Google Calendar")) {
								setConnectedCalendars(prev => {
									if (!prev.includes("Google Calendar")) {
										return [...prev, "Google Calendar"];
									}
									return prev;
								});
								setHasAutoConnected(true); // Mark as already connected, don't auto-connect
								return; // Exit - calendar is already connected
							}
						}
					}
				}
			} catch (error) {
				console.error("Error checking calendar connection status:", error);
			}
			
			// Only auto-connect if:
			// 1. User signed up with Google
			// 2. Google Calendar is not already connected
			// 3. We haven't already tried to auto-connect
			// 4. We're not in the middle of connecting
			const provider = localStorage.getItem("mira_provider");
			if (
				provider === "google" && 
				!connectedCalendars.includes("Google Calendar") && 
				!hasAutoConnected &&
				connecting !== "Google Calendar"
			) {
				console.log("User signed up with Google, auto-connecting Google Calendar...");
				setHasAutoConnected(true); // Mark that we've tried
				// Auto-trigger Google Calendar connection
				setTimeout(() => handleGoogleCalendarConnect(), 500); // Small delay to avoid race conditions
			}
		};
		
		checkConnectionStatus();
	}, [connectedCalendars, connecting, hasAutoConnected]); // Run only once on mount

	const handleGoogleCalendarConnect = async () => {
		setConnecting("Google Calendar");
		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			const token = localStorage.getItem("access_token") || localStorage.getItem("token");
			if (!token) {
				alert("Please log in first to connect Google Calendar.");
				setConnecting(null);
				return;
			}
			// Pass token and return_to so backend can extract user ID and redirect back
			window.location.href = `${apiBase}/google/calendar/oauth/start?token=${encodeURIComponent(token)}&return_to=${encodeURIComponent(window.location.href)}`;
		} catch (error) {
			console.error("Error connecting Google Calendar:", error);
			alert("Failed to connect Google Calendar. Please try again.");
			setConnecting(null);
		}
	};

	const handleOutlookCalendarConnect = async () => {
		setConnecting("Outlook Calendar");
		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			const token = localStorage.getItem("access_token") || localStorage.getItem("token");
			if (!token) {
				alert("Please log in first to connect Outlook Calendar.");
				setConnecting(null);
				return;
			}
			// Pass token, purpose and return_to so backend can identify user and redirect back after OAuth
			window.location.href = `${apiBase}/microsoft/auth?token=${encodeURIComponent(token)}&purpose=calendar&return_to=${encodeURIComponent(window.location.href)}`;
		} catch (error) {
			console.error("Error connecting Outlook Calendar:", error);
			alert("Failed to connect Outlook Calendar. Please try again.");
			setConnecting(null);
		}
	};

	const handleContinue = () => {
		try {
			localStorage.setItem(
				"mira_onboarding_step4",
				JSON.stringify({ connectedCalendars })
			);
		} catch {}

		console.log("Connected calendars:", connectedCalendars);
		router.push("/onboarding/step5");
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
						<p className="text-xs sm:text-sm text-gray-500">Step 4 of 5</p>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-4/5 transition-all"></div>
					</div>

					{/* Title + Description */}
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 text-center md:text-left">
						Link Your Calendar
					</h1>
					<p className="text-gray-600 mb-6 text-[14px] sm:text-[15px] text-center md:text-left">
						Connect your calendar to help Mira manage your schedule
					</p>

					{/* Calendar Options */}
					<div className="space-y-4">
						{[
							{ 
								icon: <FcGoogle size={22} />, 
								name: "Google Calendar",
								onClick: handleGoogleCalendarConnect,
								connected: connectedCalendars.includes("Google Calendar")
							},
							{
								icon: <FaMicrosoft size={22} color="#0078D4" />,
								name: "Outlook Calendar",
								onClick: handleOutlookCalendarConnect,
								connected: connectedCalendars.includes("Outlook Calendar")
							},
							// Microsoft Calendar - commented out as it's the same as Outlook Calendar
							// {
							// 	icon: <FaMicrosoft size={22} color="#F25022" />,
							// 	name: "Microsoft Calendar",
							// 	onClick: handleOutlookCalendarConnect,
							// 	connected: connectedCalendars.includes("Microsoft Calendar")
							// },
							{
								icon: <RiExchangeBoxFill size={22} color="#000" />,
								name: "Exchange Calendar",
								onClick: () => alert("Exchange Calendar integration coming soon!"),
								connected: connectedCalendars.includes("Exchange Calendar")
							},
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
						You can always add more calendar accounts later
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
