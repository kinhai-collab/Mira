/** @format */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import {
	extractTokenFromUrl,
	storeAuthToken,
	isAuthenticated,
} from "@/utils/auth";
// import { startMiraVoice, stopMiraVoice } from "@/utils/voice/voiceHandler";
import { setMiraMute } from "@/utils/voice/voiceHandler"; // Temporarily disabled

export default function Home() {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [isListening, setIsListening] = useState(true);
	const [greeting, setGreeting] = useState<string>("");
	const [isMicOn, setIsMicOn] = useState(false);
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [isMuted, setIsMuted] = useState(false);

	const greetingCalledRef = useRef(false);

	const handleMicToggle = () => {
		const newState = !isMicOn;
		setIsMicOn(newState);
		if (newState) {
			setIsConversationActive(true);
			startMiraVoice();
		} else {
			setIsConversationActive(false);
			stopMiraVoice();
			setIsMuted(false);
			setMiraMute(false);
		}
	};

	useEffect(() => {
		console.log("Initializing Mira...");
		startMiraVoice();
		setIsConversationActive(true);
	}, []);

	useEffect(() => {
		const init = async () => {
			const urlToken = extractTokenFromUrl();
			if (urlToken) {
				storeAuthToken(urlToken);
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);
				window.location.reload();
				return;
			}

			if (!isAuthenticated()) {
				router.push("/login");
				return;
			}

			try {
				const token =
					localStorage.getItem("access_token") ?? localStorage.getItem("token");
				if (token) {
					const apiBase = (
						process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
					).replace(/\/+$/, "");
					const email = localStorage.getItem("mira_email");

					if (email) {
						const onboardingRes = await fetch(
							`${apiBase}/onboarding_status?email=${encodeURIComponent(email)}`,
							{
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
							}
						);

						if (onboardingRes.ok) {
							const onboardingData = await onboardingRes.json();
							const onboarded = !!onboardingData?.onboarded;
							if (!onboarded) {
								router.push("/onboarding/step1");
								return;
							}
						}
					}
				}
			} catch (error) {
				console.log("Error checking onboarding status on home page:", error);
			}

			if (greetingCalledRef.current) return;
			greetingCalledRef.current = true;

			// Get user name from localStorage (updated when profile is saved)
			// The name is kept in sync via profile_update endpoint and localStorage
			setTimeout(() => {
				const userName =
					localStorage.getItem("mira_full_name") ||
					localStorage.getItem("mira_username") ||
					localStorage.getItem("user_name") ||
					"there";

				const hour = new Date().getHours();
				let timeGreeting = "Good Evening";
				if (hour < 12) timeGreeting = "Good Morning";
				else if (hour < 18) timeGreeting = "Good Afternoon";

				// Extract first name for personalized greeting
				const firstName = userName !== "there" ? userName.split(" ")[0] : userName;
				setGreeting(`${timeGreeting}, ${firstName}!`);
				// playVoice(`${timeGreeting}, ${firstName}!`); // Temporarily disabled
				console.info(
					"Greeting voice is temporarily disabled. Fallback greeting:",
					`${timeGreeting}, ${firstName}!`
				);
			}, 300);
		};
		init();
	}, [router]);

	// Listen for user data updates to refresh greeting
	useEffect(() => {
		const handleUserDataUpdate = () => {
			// Update greeting when user data changes (e.g., profile update)
			const userName =
				localStorage.getItem("mira_full_name") ||
				localStorage.getItem("mira_username") ||
				localStorage.getItem("user_name") ||
				"there";

			const hour = new Date().getHours();
			let timeGreeting = "Good Evening";
			if (hour < 12) timeGreeting = "Good Morning";
			else if (hour < 18) timeGreeting = "Good Afternoon";

			const firstName = userName !== "there" ? userName.split(" ")[0] : userName;
			setGreeting(`${timeGreeting}, ${firstName}!`);
		};

		window.addEventListener('userDataUpdated', handleUserDataUpdate);
		
		return () => {
			window.removeEventListener('userDataUpdated', handleUserDataUpdate);
		};
	}, []);

	return (
		<div className="flex flex-col min-h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden">
			<main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 relative overflow-y-auto pb-20 md:pb-0">
				{/* Top-left bar */}
				<div className="absolute top-4 sm:top-6 left-4 sm:left-10 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
					<span className="font-medium text-gray-800">Wed, Oct 15</span>
					<div className="flex items-center gap-1 px-2 sm:px-3 py-1 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm">
						<Icon name="Location" size={16} className="text-gray-600" />
						<span className="text-gray-700 font-medium">New York</span>
					</div>
					<div className="flex items-center gap-1 px-2 sm:px-3 py-1 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm">
						<Icon name="Sun" size={16} className="text-yellow-500" />
						<span className="text-gray-700 font-medium">20°</span>
					</div>
				</div>

				{/* Top-right: Morning Brief + Mute */}
				<div className="absolute top-4 sm:top-6 right-4 sm:right-10 flex items-center gap-3 sm:gap-4">
					{/* Morning Brief */}
					<button className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#FFF8E7] border border-[#FFE9B5] rounded-full text-sm font-medium text-[#B58B00] shadow-sm hover:shadow-md transition">
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Morning Brief"
							width={16}
							height={16}
						/>
						<span>Morning Brief</span>
					</button>

					{/* Show Mute only during active conversation */}
					{isConversationActive && (
						<button
							onClick={() => {
								const muteState = !isMuted;
								setIsMuted(muteState);
								setMiraMute(muteState);
							}}
							className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#F5F5F5] border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm hover:shadow-md transition"
						>
							<Image
								src={
									isMuted
										? "/Icons/Property 1=VoiceOff.svg"
										: "/Icons/Property 1=VoiceOn.svg"
								}
								alt={isMuted ? "Muted" : "Unmuted"}
								width={16}
								height={16}
							/>
							<span>{isMuted ? "Muted" : "Mute"}</span>
						</button>
					)}
				</div>

				{/* Orb + Greeting */}
				<div className="relative flex flex-col items-center mt-16 sm:mt-20">
					<div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5] shadow-[0_0_80px_15px_rgba(210,180,255,0.45)] animate-pulse"></div>
					<div className="absolute top-[35%] right-[-250px] group">
						<div className="relative bg-white px-5 py-2.5 border border-[#E4D9FF] shadow-[0_4px_20px_rgba(180,150,255,0.25)]">
							<p className="text-[#2F2F2F] text-sm sm:text-base tracking-tight">
								{greeting}
							</p>
							<div className="absolute left-[-7px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-[#E4D9FF] rotate-45"></div>
						</div>
					</div>
				</div>

				{/* Input & Example Prompts */}
				{!isConversationActive && (
					<>
						{/* Input Section */}
						<div className="relative mt-10 sm:mt-14 w-full max-w-md sm:max-w-xl flex flex-col items-center">
							<div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#f4aaff] via-[#d9b8ff] to-[#bfa3ff] opacity-95 blur-[1.5px]"></div>
							<div className="relative flex items-center rounded-xl bg-white px-4 sm:px-5 py-2 sm:py-2.5 w-full">
								<input
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									placeholder={
										isListening ? "I'm listening..." : "Type your request..."
									}
									className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-transparent text-gray-700 placeholder-gray-400 rounded-l-xl focus:outline-none font-medium text-sm sm:text-base"
								/>
								<button
									type="button"
									className="flex items-center justify-center w-9 sm:w-10 h-9 sm:h-10 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition"
								>
									<Icon name="Send" size={16} />
								</button>
							</div>
						</div>

						{/* Example Prompts */}
						<div className="mt-8 sm:mt-10 w-full max-w-md sm:max-w-xl text-left">
							<p className="text-gray-600 font-normal mb-3 text-[12px] sm:text-[13.5px]">
								Or start with an example below
							</p>
							<div className="flex flex-wrap gap-2 sm:gap-2.5">
								{[
									"How’s my day looking?",
									"Summarize today’s tasks.",
									"What meetings do I have today?",
									"What reminders do I have today?",
									"Wrap up my day.",
								].map((example, i) => (
									<button
										key={i}
										className="px-3 sm:px-3.5 py-1 sm:py-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition text-gray-700 text-[12.5px] sm:text-[13.5px] font-normal"
									>
										{example}
									</button>
								))}
							</div>
						</div>
					</>
				)}

				{/* Mic & Keyboard Toggle */}
				<div className="mt-10 sm:mt-12 flex items-center justify-center">
					<div className="relative w-[130px] sm:w-[150px] h-[36px] border border-[#000] bg-white rounded-full px-[6px] shadow-[0_1px_4px_rgba(0,0,0,0.08)] flex items-center justify-between">
						{/* Mic Button */}
						<button
							onClick={() => {
								const newState = !isListening;
								setIsListening(newState);
								if (newState) {
									setIsConversationActive(true);
									startMiraVoice();
								} else {
									setIsConversationActive(false);
									stopMiraVoice();
									setIsMuted(false);
									setMiraMute(false);
								}
							}}
							className={`flex items-center justify-center w-[60px] h-[28px] rounded-full border border-gray-200 transition-all duration-300 ${
								isListening
									? "bg-black hover:bg-gray-800"
									: "bg-white hover:bg-gray-50"
							}`}
						>
							<Image
								src={
									isListening
										? "/Icons/Property 1=Mic.svg"
										: "/Icons/Property 1=MicOff.svg"
								}
								alt={isListening ? "Mic On" : "Mic Off"}
								width={16}
								height={16}
								className={`transition-all duration-300 ${
									isListening ? "invert" : "brightness-0"
								}`}
							/>
						</button>

						{/* Keyboard Button */}
						<button
							onClick={() => {
								setIsListening(false);
								setIsConversationActive(false);
								stopMiraVoice();
								setIsMuted(false);
								setMiraMute(false);
							}}
							className={`flex items-center justify-center w-[60px] h-[28px] rounded-full border border-gray-200 transition-all duration-300 ${
								!isListening
									? "bg-black hover:bg-gray-800"
									: "bg-white hover:bg-gray-50"
							}`}
						>
							<Image
								src="/Icons/Property 1=Keyboard.svg"
								alt="Keyboard Icon"
								width={16}
								height={16}
								className={`transition-all duration-300 ${
									!isListening ? "invert" : "brightness-0"
								}`}
							/>
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
