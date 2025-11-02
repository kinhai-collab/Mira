/** @format */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Orb from "./components/Orb";
import ThinkingPanel from "./components/ThinkingPanel";
import RecommendationPanel from "./components/RecommendationPanel";
import ConfirmationPanel from "./components/ConfirmationPanel";
import {
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
} from "@/utils/voice/voiceHandler";

export default function MorningBrief() {
	const [stage, setStage] = useState<
		"thinking" | "recommendation" | "confirmation"
	>("thinking");

	const [isListening, setIsListening] = useState(true);
	const [isMuted, setIsMuted] = useState(false);
	const [isConversationActive, setIsConversationActive] = useState(false);

	useEffect(() => {
		if (stage === "thinking") {
			const timer = setTimeout(() => setStage("recommendation"), 4000);
			return () => clearTimeout(timer);
		}
	}, [stage]);

	return (
		<div className="relative flex min-h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden">
			{/* Sidebar */}
			<aside
				className="fixed left-0 top-0 h-full w-[70px] bg-white
				flex-col items-center py-8 gap-8 border-r border-gray-100 
				shadow-[2px_0_10px_rgba(0,0,0,0.03)] hidden md:flex"
			>
				<div className="w-5 h-5 rounded-full bg-gradient-to-b from-[#F9C8E4] to-[#B5A6F7]" />
				{["Grid", "Settings"].map((icon) => (
					<button
						key={icon}
						className="p-2 rounded-xl hover:bg-[#F6F0FF] transition"
					>
						<Image
							src={`/Icons/Property 1=${icon}.svg`}
							alt={icon}
							width={20}
							height={20}
						/>
					</button>
				))}
				<button className="mt-auto mb-6 p-2 rounded-xl hover:bg-[#F6F0FF] transition">
					<Image
						src="/Icons/Property 1=Bell.svg"
						alt="Bell"
						width={20}
						height={20}
					/>
				</button>
			</aside>

			{/* Main */}
			<main
				className="flex-1 flex flex-col items-center justify-center relative
				px-4 sm:px-6 md:px-10 lg:px-16"
			>
				{/* Top Bar */}
				<div
					className="absolute top-6 left-[90px] md:left-24 flex flex-wrap items-center 
					gap-2 sm:gap-3 text-xs sm:text-sm"
				>
					<span className="font-medium text-gray-800 whitespace-nowrap">
						Wed, Oct 15
					</span>

					<div
						className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 
					rounded-full bg-white/40 backdrop-blur-sm text-xs sm:text-sm"
					>
						<Image
							src="/Icons/Property 1=Location.svg"
							alt="Location"
							width={14}
							height={14}
						/>
						<span className="text-gray-700 font-medium">New York</span>
					</div>

					<div
						className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 
					rounded-full bg-white/40 backdrop-blur-sm text-xs sm:text-sm"
					>
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Weather"
							width={14}
							height={14}
						/>
						<span className="text-gray-700 font-medium">20°</span>
					</div>
				</div>

				{/* Top Right */}
				<div
					className="absolute top-6 right-4 sm:right-6 md:right-10 
					flex flex-wrap justify-center sm:justify-end items-center gap-2 sm:gap-4 text-xs sm:text-sm"
				>
					<button
						className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 
						bg-[#FFF8E7] border border-[#FFE9B5] rounded-full font-medium 
						text-[#B58B00] shadow-sm hover:shadow-md transition"
					>
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Morning Brief"
							width={14}
							height={14}
						/>
						<span>Morning Brief</span>
					</button>

					<button
						className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 
						bg-[#F5F5F5] border border-gray-200 rounded-full font-medium 
						text-gray-700 shadow-sm hover:shadow-md transition"
					>
						<Image
							src="/Icons/Property 1=VoiceOff.svg"
							alt="Mute"
							width={14}
							height={14}
						/>
						<span>Mute</span>
					</button>
				</div>

				{/* Orb */}
				<Orb />

				{/* Panel */}
				<div className="w-full flex justify-center mt-10 transition-all duration-700">
					<div
						className="w-[92%] sm:w-[85%] md:w-[80%] lg:w-[720px] 
						transition-all duration-700 ease-in-out"
					>
						{stage === "thinking" && <ThinkingPanel />}
						{stage === "recommendation" && (
							<RecommendationPanel onAccept={() => setStage("confirmation")} />
						)}
						{stage === "confirmation" && <ConfirmationPanel />}
					</div>
				</div>

				{/* Mic & Keyboard Toggle */}
				<div className="mt-10 sm:mt-12 flex items-center justify-center">
					<div
						className="relative w-[130px] sm:w-[150px] h-[36px] 
						border border-[#000] bg-white rounded-full px-[6px] 
						shadow-[0_1px_4px_rgba(0,0,0,0.08)] 
						flex items-center justify-between"
					>
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
