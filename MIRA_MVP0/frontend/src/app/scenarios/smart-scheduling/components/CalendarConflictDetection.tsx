/** @format */
"use client";

import Image from "next/image";
import { EventItem, ConflictInfo } from "./types";

/* ------------------------------------------
   ICONS
------------------------------------------- */
function getProviderIcon(provider: string) {
	switch (provider) {
		case "google":
		case "meet":
			return "/Icons/Email/Google-Meet.png";
		case "teams":
		case "microsoft":
		case "outlook":
			return "/Icons/Email/Microsoft-Teams.png";
		default:
			return "/Icons/Email/Google-Meet.png";
	}
}

function getCalendarIcon(provider?: string) {
	switch (provider) {
		case "outlook":
			return "/Icons/Email/vscode-icons_file-type-outlook.png";
		case "google":
		default:
			return "/Icons/Email/skill-icons_gmail-light.png";
	}
}

/* ------------------------------------------
   PROPS
------------------------------------------- */
interface Props {
	events: EventItem[];
	conflicts: ConflictInfo[];
	totalEvents: number;
	totalMeet: number;
	totalTeams: number;
	nextEventTitle: string;
	onReschedule: (conflict: ConflictInfo, eventToReschedule: EventItem) => void;
	onCancel: (event: EventItem) => void;
	isLoading?: boolean;
	externalConflictMessage?: string | null;
}

/* ------------------------------------------
   MAIN COMPONENT
------------------------------------------- */
export default function CalendarConflictDetection({
	events,
	conflicts,
	totalEvents,
	totalMeet,
	totalTeams,
	nextEventTitle,
	onReschedule,
	onCancel,
	isLoading = false,
	externalConflictMessage,
}: Props) {
	const hasConflict = conflicts.length > 0;

	// Get IDs of all events that are part of conflicts
	const conflictEventIds = new Set<string>();
	conflicts.forEach((c) => {
		conflictEventIds.add(c.eventA.id);
		conflictEventIds.add(c.eventB.id);
	});

	if (isLoading) {
		return (
			<div className="bg-white rounded-[24px] border border-[#E5E5E5] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-6 w-full max-w-[900px] mx-auto">
				<div className="animate-pulse">
					<div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
					<div className="space-y-3">
						<div className="h-4 bg-gray-200 rounded w-full"></div>
						<div className="h-4 bg-gray-200 rounded w-5/6"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-[24px] border border-[#E5E5E5] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-6 w-full max-w-[900px] mx-auto">
			<p className="text-[20px] font-normal text-[#1F1F1F] mb-4">
				Summarized your email and calendar.
			</p>

			{/* TOP CHECKS */}
			<div className="flex gap-3">
				<div className="border-l-[1px] border-[#382099] pl-[24px] space-y-[4px]">
					<div className="flex items-center gap-3">
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={20}
							height={20}
						/>
						<p className="text-[16px] text-[#1F1F1F]">
							Checked your inbox for priority emails.
						</p>
					</div>

				<div className="flex items-center gap-3">
					<Image
						src="/Icons/Property 1=Done in circle.svg"
						alt="done"
						width={20}
						height={20}
					/>
					<p className="text-[16px] text-[#1F1F1F]">
						Reviewed today's calendar events.
					</p>
				</div>
				</div>
			</div>

			<div className="mt-[10px] flex items-center gap-1 w-fit ml-[24px]">
				<p className="text-[14px] font-medium text-[#735FF8]">See More</p>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					className="transition-transform rotate-90"
				>
					<path
						d="M6 9L12 15L18 9"
						stroke="#735FF8"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>

			{/* EVENTS HEADER */}
			<div className="flex items-center pt-4 justify-between w-full mb-4 pr-1">
				<div className="flex items-center gap-2">
					<p className="text-[17px] font-semibold text-[#1F1F1F]">
						{totalEvents} Events
					</p>
					<p className="text-[#6B6B6B] text-[14px]">24 hours</p>

					<div className="flex items-center gap-1">
						<Image
							src="/Icons/Email/Google-Meet.png"
							alt="Google Meet"
							width={18}
							height={18}
						/>
						<span className="text-[14px] text-[#1F1F1F]">{totalMeet} Meet</span>
					</div>

					<div className="flex items-center gap-1">
						<Image
							src="/Icons/Email/Microsoft-Teams.png"
							alt="Teams"
							width={18}
							height={18}
						/>
						<span className="text-[14px] text-[#1F1F1F]">
							{totalTeams} Teams
						</span>
					</div>
				</div>

				<p className="text-[14px] text-[#6B6B6B]">
					<span className="inline-block w-2 h-2 rounded-full bg-[#6B4EFF] mr-1" />
					Next Event:{" "}
					<span className="text-[#1F1F1F] font-medium">{nextEventTitle}</span>
				</p>
			</div>

			{/* EVENT GRID */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{events.map((event) => {
					const isConflict = conflictEventIds.has(event.id);

					return (
						<div
							key={event.id}
							className={`flex items-center justify-between bg-white rounded-[14px] px-4 py-3 transition border ${
								isConflict
									? "border-[#CC5A67] bg-[#F9EDEE]"
									: "border-[#EDEDED]"
							}`}
						>
							<div className="flex items-start gap-3">
								<Image
									src={getProviderIcon(event.provider)}
									alt={event.provider}
									width={28}
									height={28}
								/>
								<div>
									<div className="flex items-center gap-2">
										<p className="text-[15px] font-medium text-[#1F1F1F]">
											{event.title}
										</p>
										{event.calendarProvider && (
											<Image
												src={getCalendarIcon(event.calendarProvider)}
												alt={event.calendarProvider}
												width={14}
												height={14}
												className="opacity-70"
											/>
										)}
									</div>
									<p className="text-[14px] text-[#6B6B6B]">
										{event.time} | {event.attendee}
									</p>
									{isConflict && (
										<span className="inline-flex items-center text-[12px] text-[#BE4B48] mt-1">
											⚠️ Overlapping event
										</span>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>

		{/* CONFLICT SECTION – aligned with Figma "Calendar Conflicts Identified" */}
		{hasConflict && (
			<div className="mt-6 space-y-2">
				{/* Warning line with purple border */}
				<div className="pl-[4px]">
					<div className="border-l border-[#382099] pl-[24px] flex items-center gap-2">
						<svg
							width="18"
							height="18"
							viewBox="0 0 32 32"
							fill="none"
							className="shrink-0"
						>
							<path
								d="M16 8V16M16 20H16.01M28 16C28 22.6274 22.6274 28 16 28C9.37258 28 4 22.6274 4 16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16Z"
								stroke="#382099"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<p className="text-[16px] text-[#282829]">
							Found an overlapping event at{" "}
							{conflicts[0]?.overlapStart &&
								new Date(conflicts[0].overlapStart).toLocaleTimeString(
									"en-US",
									{
										hour: "numeric",
										minute: "2-digit",
										hour12: true,
									}
								)}
							-
							{conflicts[0]?.overlapEnd &&
								new Date(conflicts[0].overlapEnd).toLocaleTimeString("en-US", {
									hour: "numeric",
									minute: "2-digit",
									hour12: true,
								})}{" "}
							today.
						</p>
					</div>
				</div>

				{/* External conflict message */}
				{externalConflictMessage && (
					<div className="pl-[24px] mt-2">
						<p className="text-[14px] text-[#6B6B6B]">{externalConflictMessage}</p>
					</div>
				)}

			{/* Action buttons */}
			<div className="pl-[24px] pt-4 flex gap-3">
				<button
					onClick={() => {
						const first = conflicts[0];
						if (first) onReschedule(first, first.eventA);
					}}
					className="bg-[#464647] text-white px-4 py-2 rounded-full text-[18px] hover:bg-[#3a3a3b] transition"
				>
					Reschedule Event
				</button>
				<button
					onClick={() => {
						if (typeof window !== "undefined") {
							window.location.href = "/";
						}
					}}
					className="bg-white border border-[#464647] text-[#282829] px-4 py-2 rounded-full text-[18px] hover:bg-gray-50 transition"
				>
					Cancel
				</button>
			</div>
			</div>
		)}

			{/* No conflicts message */}
			{!hasConflict && events.length > 0 && (
				<div className="mt-6 p-4 bg-[#F0FFF4] rounded-xl border border-[#95D6A4]">
					<div className="flex items-center gap-2">
						<span className="text-[#22C55E]">✓</span>
						<p className="text-[15px] text-[#1F1F1F]">
							No scheduling conflicts found. Your calendar looks good!
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
