/** @format */
"use client";

import HeaderBar from "@/components/HeaderBar";
import ThinkingPanel from "./components/ThinkingPanel";
import Orb from "./components/Orb";
import CalendarSummaryPanel from "./components/CalendarSummaryPanel";
import { useState, useEffect } from "react";
import ReschedulingPanel from "./components/ReschedulingPanel";
import MeetingConfirmationUI from "./components/MeetingConfirmationUI";
import CalendarConflictDetection from "./components/CalendarConflictDetection";
import FooterBar from "@/components/FooterBar";
import {
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
} from "@/utils/voice/voiceHandler";

export default function CalendarFlowPage() {
	const [stage, setStage] = useState<
		"thinking" | "summary" | "conflict" | "rescheduling" | "confirmation"
	>("thinking");
	// FooterBar states

	const [isListening, setIsListening] = useState(true); // mic selected by default
	const [isTextMode, setIsTextMode] = useState(false);
	const [isConversationActive, setIsConversationActive] = useState(false);
	const [isMuted, setIsMuted] = useState(false);

	useEffect(() => {
		const timers: NodeJS.Timeout[] = [];

		timers.push(setTimeout(() => setStage("summary"), 2000)); // 2s
		timers.push(setTimeout(() => setStage("conflict"), 4000)); // 4s
		timers.push(setTimeout(() => setStage("rescheduling"), 6000)); // 6s
		timers.push(setTimeout(() => setStage("confirmation"), 8500)); // 8.5s

		return () => timers.forEach((t) => clearTimeout(t));
	}, []);

	const sampleEvents = [
		{
			id: "1",
			title: "Project Timeline & Budget Discussion",
			time: "12 pm - 1 pm",
			attendee: "David Olibear",
			provider: "google",
		},
		{
			id: "2",
			title: "Quarterly Budget Review",
			time: "2 pm - 2:30 pm",
			attendee: "Sam Altman",
			provider: "google",
		},
		{
			id: "3",
			title: "Marketing Budget Approval",
			time: "4 pm - 5 pm",
			attendee: "Kate Foret",
			provider: "google",
		},
		{
			id: "4",
			title: "Revised Marketing Budget",
			time: "4 pm - 5 pm",
			attendee: "Sam Foleigh",
			provider: "teams",
		},
	];

	const rescheduledEvents = sampleEvents.map((ev) =>
		ev.id === "4" ? { ...ev, time: "10:00 am - 10:30 am" } : ev
	);
	const location = "Pittsburgh";
	const temperatureC = 22;
	const isLocationLoading = false;
	const isWeatherLoading = false;

	return (
		<div className="flex min-h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden">
			{/* Header */}
			<div className="absolute top-6 left-0 w-full pl-[70px] md:pl-[90px]">
				<HeaderBar
					dateLabel={new Date().toLocaleDateString("en-US", {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}
					locationLabel={location}
					temperatureLabel={
						temperatureC != null ? `${Math.floor(temperatureC)}°` : "--"
					}
					isLocationLoading={isLocationLoading}
					isWeatherLoading={isWeatherLoading}
				/>
			</div>

			{/* MAIN */}
			<main
				className="
              flex-1 flex flex-col items-center 
              px-4 sm:px-6 md:px-10 lg:px-16 
              pt-28
            "
			>
				{/* SCALE WRAPPER */}
				<div className="scale-[0.90] flex flex-col items-center">
					{/* ORB */}
					<div className="flex flex-col items-center justify-center">
						<Orb />
					</div>

					{/* PANEL */}
					<div className="w-full flex justify-center mt-10">
						<div
							className="
                            w-[92%] sm:w-[85%] md:w-[80%] lg:w-[720px]
                            transition-all duration-700 ease-in-out
                        "
						>
							{stage === "thinking" && <ThinkingPanel />}

							{stage === "summary" && (
								<CalendarSummaryPanel
									events={sampleEvents}
									totalEvents={4}
									totalMeet={3}
									totalTeams={1}
									nextEventTitle="Project Timeline & Budget Discussion"
								/>
							)}
							{stage === "conflict" && (
								<CalendarConflictDetection
									events={sampleEvents}
									totalEvents={sampleEvents.length}
									totalMeet={3}
									totalTeams={1}
									nextEventTitle="Project Timeline & Budget Discussion"
								/>
							)}

							{stage === "rescheduling" && <ReschedulingPanel />}

							{stage === "confirmation" && (
								<MeetingConfirmationUI
									events={rescheduledEvents}
									rescheduledEventId="4"
									newTime="10:00 AM – 10:30 AM"
								/>
							)}
						</div>
					</div>
				</div>
			</main>
			<FooterBar
				isListening={isListening}
				isTextMode={isTextMode}
				setIsListening={setIsListening}
				setIsTextMode={setIsTextMode}
				setIsConversationActive={setIsConversationActive}
				setIsMuted={setIsMuted}
				startMiraVoice={startMiraVoice}
				stopMiraVoice={stopMiraVoice}
				setMiraMute={setMiraMute}
			/>
		</div>
	);
}
