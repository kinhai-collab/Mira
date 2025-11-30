/** @format */
"use client";

import Image from "next/image";
import { EventItem } from "../components/types";

/* -------------------------------------------------
   TIME PARSER
-------------------------------------------------- */
function parseTime(str: string) {
	const [hRaw, modifier] = str.trim().split(" ");
	let hour = parseInt(hRaw, 10);

	if (modifier === "pm" && hour !== 12) hour += 12;
	if (modifier === "am" && hour === 12) hour = 0;

	return hour * 60;
}

/* -------------------------------------------------
   CONFLICT DETECTOR
-------------------------------------------------- */
function findConflicts(events: EventItem[]) {
	if (!Array.isArray(events)) return [];

	const conflicts = new Set<string>();

	for (let i = 0; i < events.length; i++) {
		const [startA, endA] = events[i].time.split(" - ");
		const aStart = parseTime(startA);
		const aEnd = parseTime(endA);

		for (let j = i + 1; j < events.length; j++) {
			const [startB, endB] = events[j].time.split(" - ");
			const bStart = parseTime(startB);
			const bEnd = parseTime(endB);

			if (aStart < bEnd && bStart < aEnd) {
				conflicts.add(events[i].id);
				conflicts.add(events[j].id);
			}
		}
	}

	return Array.from(conflicts);
}

/* -------------------------------------------------
   MAIN
-------------------------------------------------- */
export default function MeetingConfirmationUI({
	events,
	rescheduledEventId,
	newTime,
}: {
	events: EventItem[];
	rescheduledEventId: string;
	newTime: string;
}) {
	/* Provider Icon */
	const getProviderIcon = (provider: string) => {
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
	};

	const conflictIds = findConflicts(events);

	/* ---- UI START ---- */
	return (
		<div
			className="
                bg-white 
                rounded-[24px]
                border border-[#E5E5E5]
                shadow-[0_4px_12px_rgba(0,0,0,0.04)]
                p-6
                w-full
                max-w-[900px]
                mx-auto
            "
		>
			<p className="text-[20px] font-normal text-[#1F1F1F] mb-4">
				Summarized your email and calendar.
			</p>

			{/* -------------------------------------------
			   TOP CHECKMARKS
			-------------------------------------------- */}
			<div className="flex gap-3 mb-4">
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

			{/* -------------------------------------------
			   HEADER
			-------------------------------------------- */}
			<div className="flex items-center justify-between w-full mb-4 pr-1">
				<div className="flex items-center gap-2">
					<p className="text-[17px] font-semibold text-[#1F1F1F]">
						{events.length} Events
					</p>
					<p className="text-[#6B6B6B] text-[14px]">24 hours</p>

					{/* Meet */}
					<div className="flex items-center gap-1">
						<Image
							src="/Icons/Email/Google-Meet.png"
							alt="Meet"
							width={18}
							height={18}
						/>
						<span className="text-[14px] text-[#1F1F1F]">
							{
								events.filter(
									(e) => e.provider === "meet" || e.provider === "google"
								).length
							}{" "}
							Meet
						</span>
					</div>

					{/* Teams */}
					<div className="flex items-center gap-1">
						<Image
							src="/Icons/Email/Microsoft-Teams.png"
							alt="Teams"
							width={18}
							height={18}
						/>
						<span className="text-[14px] text-[#1F1F1F]">
							{
								events.filter(
									(e) => e.provider === "teams" || e.provider === "microsoft"
								).length
							}{" "}
							Teams
						</span>
					</div>
				</div>

				<p className="text-[14px] text-[#6B6B6B]">
					<span className="inline-block w-2 h-2 rounded-full bg-[#6B4EFF] mr-1" />
					Next Event:{" "}
					<span className="text-[#1F1F1F] font-medium">
						{events[0]?.title || "Upcoming Event"}
					</span>
				</p>
			</div>

			{/* -------------------------------------------
			   EVENT GRID — ALWAYS SHOWN
			-------------------------------------------- */}
			{/* EVENT GRID */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
				{events.map((event) => {
					const isRescheduled = event.id === rescheduledEventId;

					return (
						<div
							key={event.id}
							className={`
                    flex items-center justify-between rounded-[14px] px-4 py-3 transition border
                    ${
											isRescheduled
												? "border-[#735FF8] bg-[#EFE9FF]" // BLUE RESCHEDULED STYLE
												: "border-[#EDEDED] bg-white"
										}
                `}
						>
							<div className="flex items-start gap-3">
								<Image
									src={
										event.provider === "teams"
											? "/Icons/Email/Microsoft-Teams.png"
											: "/Icons/Email/Google-Meet.png"
									}
									alt={event.provider}
									width={28}
									height={28}
									className="rounded-md"
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
					);
				})}
			</div>

			{/* -------------------------------------------
			   CONFIRMATION MESSAGE
			-------------------------------------------- */}
			<div className="mt-6">
				<p className="text-[15px] text-[#1F1F1F] leading-relaxed">
					<span className="inline-block w-2 h-2 rounded-full bg-[#6B4EFF] mr-2"></span>
					The meeting was rescheduled to{" "}
					<span className="font-semibold">{newTime}</span> and added to your
					calendar.
				</p>

				<p className="text-[14px] text-[#6B6B6B] mt-1">
					Based on your team’s and your own calendars availability.
				</p>

				{/* BUTTONS */}
				<div className="flex items-center gap-4 mt-4">
					<button className="bg-black text-white px-5 py-[10px] rounded-full text-[14px]">
						View Calendar
					</button>

					<button className="border border-[#CECECE] text-[#2B2B2B] px-5 py-[10px] rounded-full text-[14px]">
						Cancel
					</button>

					<button className="text-[#735FF8] text-[14px] font-medium underline">
						Suggest other time slots
					</button>
				</div>
			</div>
		</div>
	);
}
