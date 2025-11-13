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
	const [hasAutoConnected, setHasAutoConnected] = useState(false); // Track if we've already tried auto-connect

	// Check for Gmail and Outlook connection status on component mount
	useEffect(() => {
		const checkConnectionStatus = async () => {
			// Check URL parameters for OAuth callbacks
			const urlParams = new URLSearchParams(window.location.search);
			const gmailConnected = urlParams.get("gmail_connected");
			const gmailAccessToken = urlParams.get("access_token");
			const gmailEmail = urlParams.get("email");
			const msConnected = urlParams.get("ms_connected");
			const msEmail = urlParams.get("email");

			// Handle Gmail callback FIRST (before auto-connect logic)
			if (gmailConnected === "true" && gmailAccessToken && gmailEmail) {
				// Store Gmail access token
				localStorage.setItem("gmail_access_token", gmailAccessToken);
				localStorage.setItem("gmail_email", gmailEmail);
				// Also save refresh token if available (for persistence)
				const gmailRefreshToken = urlParams.get("gmail_refresh_token") || urlParams.get("refresh_token");
				if (gmailRefreshToken) {
					localStorage.setItem("gmail_refresh_token", gmailRefreshToken);
				}
				
				// Add Gmail to connected emails (but don't auto-save - user must click Save)
				setConnectedEmails(prev => {
					if (!prev.includes("Gmail")) {
						return [...prev, "Gmail"];
					}
					return prev;
				});

				// Check if calendar scopes were also granted - if so, save calendar credentials
				const calendarScopeGranted = urlParams.get("calendar_scope_granted") === "true";
				if (calendarScopeGranted) {
					try {
						const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
						const { getValidToken } = await import("@/utils/auth");
						const token = await getValidToken();
						if (token) {
							const gmailRefreshToken = urlParams.get("gmail_refresh_token") || urlParams.get("refresh_token");
							const saveCalendarRes = await fetch(`${apiBase}/gmail/calendar/save-from-gmail`, {
								method: "POST",
								headers: {
									'Authorization': `Bearer ${token}`,
									'Content-Type': 'application/json'
								},
								body: JSON.stringify({
									gmail_access_token: gmailAccessToken,
									gmail_refresh_token: gmailRefreshToken
								})
							});
							
							if (saveCalendarRes.ok) {
								console.log("Calendar credentials saved from Gmail OAuth in step 3");
							}
						}
					} catch (error) {
						console.error("Error saving calendar credentials from Gmail:", error);
					}
				}

				// Clear URL parameters
				window.history.replaceState({}, document.title, window.location.pathname);
				
				// Mark that we've handled the callback, so auto-connect won't run
				setHasAutoConnected(true);
				
				// Show success message
				if (calendarScopeGranted) {
					alert(`Gmail and Google Calendar connected successfully! Email: ${gmailEmail}`);
				} else {
					alert(`Gmail connected successfully! Email: ${gmailEmail}`);
				}
				return; // Exit early - don't run auto-connect logic
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
				return; // Exit early
			}
			
			// Check if Gmail is already connected via backend/user_settings
			// IMPORTANT: Just because user signed up with Google doesn't mean Gmail API is connected
			// We need to verify via backend that Gmail was actually connected via separate OAuth flow
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
							const connectedEmailsList = settingsResult.data.connectedEmails || [];
							if (connectedEmailsList.length > 0) {
								setConnectedEmails(prev => {
									// Merge with existing, avoiding duplicates
									const merged = [...prev];
									connectedEmailsList.forEach((email: string) => {
										if (!merged.includes(email)) {
											merged.push(email);
										}
									});
									return merged;
								});
								// If Gmail is already connected (saved in database), don't auto-connect
								if (connectedEmailsList.includes("Gmail")) {
									setHasAutoConnected(true);
									return; // Exit - Gmail is already connected
								}
							}
						}
					}
				}
			} catch (error) {
				console.error("Error checking email connection status:", error);
			}
			
			// NOTE: We do NOT check localStorage for gmail_access_token here because:
			// 1. Signing up with Google via Supabase doesn't grant Gmail API access
			// 2. Gmail requires a separate OAuth flow with specific scopes
			// 3. Only mark as connected if OAuth callback confirms it OR backend confirms it's saved
			
			// Only auto-connect if:
			// 1. User signed up with Google
			// 2. Gmail is not already connected
			// 3. We haven't already tried to auto-connect
			// 4. We're not in the middle of connecting
			const provider = localStorage.getItem("mira_provider");
			if (
				provider === "google" && 
				!connectedEmails.includes("Gmail") && 
				!hasAutoConnected &&
				connecting !== "Gmail"
			) {
				console.log("User signed up with Google, auto-connecting Gmail...");
				setHasAutoConnected(true); // Mark that we've tried
				// Auto-trigger Gmail connection
				setTimeout(() => handleGmailConnect(), 500); // Small delay to avoid race conditions
			}
		};
		
		checkConnectionStatus();
	}, [connectedEmails, connecting, hasAutoConnected]); // Run only once on mount

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

    // const handleMicrosoft365Connect = async () => {
    //     setConnecting("Microsoft 365");
    //     try {
    //         const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
    //         // Pass return_to so settings page redirects back here after OAuth
    //         window.location.href = `${apiBase}/microsoft/auth?return_to=${encodeURIComponent(window.location.href)}`;
    //     } catch (error) {
    //         console.error("Error connecting Microsoft 365:", error);
    //         alert("Failed to connect Microsoft 365. Please try again.");
    //         setConnecting(null);
    //     }
    // };

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
