/** @format */
"use client";

import Image from "next/image";
import { EventItem } from "./types";

function getProviderIcon(provider: string) {
	switch (provider) {
		case "google":
		case "meet":
			return "/Icons/Email/Google-Meet.png";
		case "teams":
		case "microsoft":
			return "/Icons/Email/Microsoft-Teams.png";
		default:
			return "/Icons/Email/Google-Meet.png";
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
	return (
		<div className="bg-white rounded-[24px] border border-[#E5E5E5] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-6 w-full max-w-[900px] mx-auto">
			{/* HEADER */}
			<p className="text-[20px] font-normal text-[#1F1F1F] mb-3">
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
							Reviewed today’s calendar events.
						</p>
					</div>
				</div>
			</div>

			<div className="mt-[10px] flex items-center gap-1 cursor-pointer group w-fit ml-[24px]">
				<p className="text-[14px] font-medium text-[#735FF8] group-hover:underline underline-offset-2">
					See More
				</p>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
					<path
						d="M6 9L12 15L18 9"
						stroke="#735FF8"
						width={2}
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
							alt="Meet"
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

			{/* EVENT GRID — ONLY EVENTS */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{events.map((event) => (
					<div
						key={event.id}
						className="flex items-center justify-between bg-white rounded-[14px] px-4 py-3 border border-[#EDEDED]"
					>
						<div className="flex items-start gap-3">
							<Image
								src={getProviderIcon(event.provider)}
								alt={event.provider}
								width={28}
								height={28}
							/>

							<div>
								<p className="text-[15px] font-medium text-[#1F1F1F]">
									{event.title}
								</p>
								<p className="text-[14px] text-[#6B6B6B]">
									{event.time} | {event.attendee}
								</p>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
