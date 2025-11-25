/** @format */
"use client";

import Image from "next/image";
import { EventItem } from "../components/types";

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
			return "/Icons/Email/Microsoft-Teams.png";
		default:
			return "/Icons/Email/Google-Meet.png";
	}
}

/* ------------------------------------------
   TIME PARSER
------------------------------------------- */
function parseTime(str: string) {
	const [hRaw, modifier] = str.trim().split(" ");
	let hour = parseInt(hRaw, 10);

	if (modifier === "pm" && hour !== 12) hour += 12;
	if (modifier === "am" && hour === 12) hour = 0;

	return hour * 60;
}

/* ------------------------------------------
   FIND CONFLICTS
------------------------------------------- */
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

/* ------------------------------------------
   PROPS
------------------------------------------- */
interface Props {
	events: EventItem[];
	totalEvents: number;
	totalMeet: number;
	totalTeams: number;
	nextEventTitle: string;
}

/* ------------------------------------------
   MAIN COMPONENT
------------------------------------------- */
export default function CalendarConflictDetection({
	events,
	totalEvents,
	totalMeet,
	totalTeams,
	nextEventTitle,
}: Props) {
	const conflictIds = findConflicts(events);
	const hasConflict = conflictIds.length > 0;

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
					const isConflict = conflictIds.includes(event.id);

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

			{/* CONFLICT SECTION */}
			{hasConflict && (
				<>
					<div className="flex items-start gap-2 mt-6 ml-[4px]">
						<span className="text-[#BE4B48] text-lg">⚠️</span>
						<p className="text-[15px] text-[#2D2D2D]">
							Found an overlapping event today.
						</p>
					</div>

					<div className="flex gap-3 pl-1 mt-1">
						<div className="relative">
							<div className="absolute left-[7px] top-[12px] bottom-0 w-[2px] bg-[#C9BDFC]" />
							<div className="w-[10px] h-[10px] rounded-full bg-[#9E2A2F] mt-[2px]" />
						</div>

						<div className="space-y-3 text-[#1F1F1F]">
							<p className="text-[16px] font-semibold">
								Rescheduling the meeting…
							</p>

							<div className="flex items-center gap-3">
								<Image
									src="/Icons/Property 1=Done in circle.svg"
									alt="done"
									width={18}
									height={18}
								/>
								<p className="text-[15px] text-[#303030]">
									Checked which meeting is scheduled next.
								</p>
							</div>

							<div className="flex items-center gap-3">
								<Image
									src="/Icons/Property 1=Done in circle.svg"
									alt="done"
									width={18}
									height={18}
								/>
								<p className="text-[15px] text-[#303030]">
									Reviewed your availability tomorrow.
								</p>
							</div>

							<button className="text-[#735FF8] text-[14px] font-medium flex items-center gap-[2px] group">
								<span className="group-hover:underline underline-offset-2">
									See More
								</span>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
									<path d="M6 9L12 15L18 9" stroke="#735FF8" strokeWidth="2" />
								</svg>
							</button>
						</div>
					</div>

					<div className="mt-6 pl-[22px]">
						<button className="border border-[#CECECE] text-[#2B2B2B] px-5 py-[10px] rounded-full text-[15px]">
							Cancel
						</button>
					</div>
				</>
			)}
		</div>
	);
}
