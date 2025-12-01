/** @format */
"use client";

import Image from "next/image";
import { EventItem } from "./types";
import { useState } from "react";

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

interface Props {
	events: EventItem[];
	totalEvents: number;
	totalMeet: number;
	totalTeams: number;
	nextEventTitle: string;
}

export default function CalendarSummaryPanel({
	events,
	totalEvents,
	totalMeet,
	totalTeams,
	nextEventTitle,
}: Props) {
	const [showSeeMore, setShowSeeMore] = useState(false);

	return (
		<div className="bg-white rounded-[24px] border border-[#E5E5E5] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-6 w-full max-w-[900px] mx-auto">
			{/* HEADER */}
			<p className="text-[20px] font-normal text-[#1F1F1F] mb-3">
				{events.length === 0
					? "No events scheduled for today."
					: "Summarized your email and calendar."}
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

					{events.length === 0 && (
						<div className="flex items-center gap-3">
							<span className="w-5 h-5 flex items-center justify-center text-[#22C55E]">
								✓
							</span>
							<p className="text-[16px] text-[#22C55E]">
								Your calendar is clear for today!
							</p>
						</div>
					)}
				</div>
			</div>

			<div
				className="mt-[10px] flex items-center gap-1 cursor-pointer group w-fit ml-[24px]"
				onClick={() => setShowSeeMore(!showSeeMore)}
			>
				<p className="text-[14px] font-medium text-[#735FF8] group-hover:underline underline-offset-2">
					{showSeeMore ? "Hide Details" : "See More"}
				</p>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					className={`transition-transform ${showSeeMore ? "rotate-180" : ""}`}
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
			{events.length > 0 && (
				<>
					<div className="flex items-center pt-4 justify-between w-full mb-4 pr-1">
						<div className="flex items-center gap-2">
							<p className="text-[17px] font-semibold text-[#1F1F1F]">
								{totalEvents} Events
							</p>
							<p className="text-[#6B6B6B] text-[14px]">24 hours</p>

							{totalMeet > 0 && (
								<div className="flex items-center gap-1">
									<Image
										src="/Icons/Email/Google-Meet.png"
										alt="Meet"
										width={18}
										height={18}
									/>
									<span className="text-[14px] text-[#1F1F1F]">
										{totalMeet} Google
									</span>
								</div>
							)}

							{totalTeams > 0 && (
								<div className="flex items-center gap-1">
									<Image
										src="/Icons/Email/Microsoft-Teams.png"
										alt="Teams"
										width={18}
										height={18}
									/>
									<span className="text-[14px] text-[#1F1F1F]">
										{totalTeams} Outlook
									</span>
								</div>
							)}
						</div>

						<p className="text-[14px] text-[#6B6B6B]">
							<span className="inline-block w-2 h-2 rounded-full bg-[#6B4EFF] mr-1" />
							Next Event:{" "}
							<span className="text-[#1F1F1F] font-medium">{nextEventTitle}</span>
						</p>
					</div>

					{/* EVENT GRID */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{events.map((event) => (
							<div
								key={event.id}
								className="flex items-center justify-between bg-white rounded-[14px] px-4 py-3 border border-[#EDEDED] hover:border-[#735FF8] hover:shadow-sm transition-all"
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
										{event.location && (
											<p className="text-[12px] text-[#9B9B9B] mt-1">
												📍 {event.location}
											</p>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			{/* Empty state */}
			{events.length === 0 && (
				<div className="mt-6 text-center py-8">
					<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F0FFF4] flex items-center justify-center">
						<span className="text-3xl">📅</span>
					</div>
					<p className="text-[16px] text-[#6B6B6B]">
						No calendar events found for today.
					</p>
					<p className="text-[14px] text-[#9B9B9B] mt-1">
						Use the "Add Event" button to schedule something.
					</p>
				</div>
			)}
		</div>
	);
}
