/** @format */
"use client";

import Image from "next/image";
import { EventItem } from "./types";
import { useRouter } from "next/navigation";

/* -------------------------------------------------
   PROPS
-------------------------------------------------- */
interface Props {
	events: EventItem[];
	rescheduledEvent: EventItem | null;
	newTime: string;
	actionType: "rescheduled" | "cancelled" | "scheduled";
	onViewCalendar: () => void;
	onSuggestOther: () => void;
	onDone: () => void;
}

/* -------------------------------------------------
   ICONS
-------------------------------------------------- */
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

/* -------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------- */
export default function MeetingConfirmationUI({
	events,
	rescheduledEvent,
	newTime,
	actionType,
	onViewCalendar,
	onSuggestOther,
	onDone,
}: Props) {
	const router = useRouter();

	// Get action-specific messaging
	const getActionMessage = () => {
		switch (actionType) {
			case "rescheduled":
				return {
					title: "Meeting rescheduled successfully!",
					detail: `The meeting was rescheduled to ${newTime} and updated in your calendar.`,
					icon: "🔄",
					color: "#735FF8",
					bgColor: "#F8F6FF",
				};
			case "cancelled":
				return {
					title: "Meeting cancelled successfully!",
					detail: "The meeting has been removed from your calendar.",
					icon: "🗑️",
					color: "#BE4B48",
					bgColor: "#FDF0EF",
				};
			case "scheduled":
				return {
					title: "Meeting scheduled successfully!",
					detail: `The meeting has been added to your calendar at ${newTime}.`,
					icon: "✅",
					color: "#22C55E",
					bgColor: "#F0FFF4",
				};
		}
	};

	const actionMessage = getActionMessage();

	// Count events by provider
	const googleEvents = events.filter(
		(e) =>
			e.calendarProvider === "google" ||
			e.provider === "meet" ||
			e.provider === "google"
	);
	const outlookEvents = events.filter(
		(e) =>
			e.calendarProvider === "outlook" ||
			e.provider === "teams" ||
			e.provider === "microsoft"
	);

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
			{/* Success Banner */}
			<div
				className="rounded-xl px-4 py-3 mb-6 border"
				style={{
					backgroundColor: actionMessage.bgColor,
					borderColor: actionMessage.color,
				}}
			>
				<div className="flex items-center gap-3">
					<span className="text-2xl">{actionMessage.icon}</span>
					<div>
						<p
							className="text-[16px] font-semibold"
							style={{ color: actionMessage.color }}
						>
							{actionMessage.title}
						</p>
						<p className="text-[14px] text-[#6B6B6B] mt-1">
							{actionMessage.detail}
						</p>
					</div>
				</div>
			</div>

			<p className="text-[20px] font-normal text-[#1F1F1F] mb-4">
				Your calendar has been updated.
			</p>

			{/* TOP CHECKMARKS */}
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
							{actionType === "cancelled"
								? "Removed event from calendar."
								: "Updated your calendar event."}
						</p>
					</div>

					{actionType === "rescheduled" && (
						<div className="flex items-center gap-3">
							<Image
								src="/Icons/Property 1=Done in circle.svg"
								alt="done"
								width={20}
								height={20}
							/>
							<p className="text-[16px] text-[#1F1F1F]">
								Checked for scheduling conflicts.
							</p>
						</div>
					)}

					<div className="flex items-center gap-3">
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={20}
							height={20}
						/>
						<p className="text-[16px] text-[#1F1F1F]">
							Calendar sync complete.
						</p>
					</div>
				</div>
			</div>

			{/* HEADER */}
			<div className="flex items-center justify-between w-full mb-4 pr-1">
				<div className="flex items-center gap-2">
					<p className="text-[17px] font-semibold text-[#1F1F1F]">
						{events.length} Events Today
					</p>
					<p className="text-[#6B6B6B] text-[14px]">24 hours</p>

					{/* Google Calendar count */}
					{googleEvents.length > 0 && (
						<div className="flex items-center gap-1">
							<Image
								src="/Icons/Email/skill-icons_gmail-light.png"
								alt="Google"
								width={18}
								height={18}
							/>
							<span className="text-[14px] text-[#1F1F1F]">
								{googleEvents.length} Google
							</span>
						</div>
					)}

					{/* Outlook count */}
					{outlookEvents.length > 0 && (
						<div className="flex items-center gap-1">
							<Image
								src="/Icons/Email/vscode-icons_file-type-outlook.png"
								alt="Outlook"
								width={18}
								height={18}
							/>
							<span className="text-[14px] text-[#1F1F1F]">
								{outlookEvents.length} Outlook
							</span>
						</div>
					)}
				</div>
			</div>

			{/* EVENT GRID */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
				{events.map((event) => {
					const isRescheduled = rescheduledEvent?.id === event.id;

					return (
						<div
							key={event.id}
							className={`
								flex items-center justify-between rounded-[14px] px-4 py-3 transition border
								${
									isRescheduled
										? "border-[#735FF8] bg-[#EFE9FF]"
										: "border-[#EDEDED] bg-white"
								}
							`}
						>
							<div className="flex items-start gap-3">
								<Image
									src={getProviderIcon(event.provider)}
									alt={event.provider}
									width={28}
									height={28}
									className="rounded-md"
								/>

								<div>
									<div className="flex items-center gap-2">
										<p className="text-[15px] font-medium text-[#1F1F1F]">
											{event.title}
										</p>
										{isRescheduled && (
											<span className="text-[11px] bg-[#735FF8] text-white px-2 py-0.5 rounded-full">
												{actionType === "scheduled" ? "NEW" : "UPDATED"}
											</span>
										)}
									</div>
									<p className="text-[14px] text-[#6B6B6B]">
										{event.time} | {event.attendee}
									</p>
									{event.calendarProvider && (
										<div className="flex items-center gap-1 mt-1">
											<Image
												src={getCalendarIcon(event.calendarProvider)}
												alt={event.calendarProvider}
												width={12}
												height={12}
											/>
											<span className="text-[11px] text-[#9B9B9B]">
												{event.calendarProvider === "google"
													? "Google Calendar"
													: "Outlook Calendar"}
											</span>
										</div>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* CONFIRMATION MESSAGE */}
			<div className="mt-6">
				<p className="text-[15px] text-[#1F1F1F] leading-relaxed">
					<span className="inline-block w-2 h-2 rounded-full bg-[#6B4EFF] mr-2"></span>
					{actionType === "cancelled" ? (
						<>The meeting has been removed from your calendar.</>
					) : (
						<>
							The meeting{" "}
							{actionType === "scheduled" ? "was scheduled for" : "was rescheduled to"}{" "}
							<span className="font-semibold">{newTime}</span> and{" "}
							{actionType === "scheduled" ? "added to" : "updated in"} your
							calendar.
						</>
					)}
				</p>

				<p className="text-[14px] text-[#6B6B6B] mt-1">
					{actionType === "rescheduled" &&
						"Based on your and your team's calendar availability."}
					{actionType === "scheduled" &&
						"The event has been synced to your calendar."}
					{actionType === "cancelled" &&
						"Any attendees have been notified of the cancellation."}
				</p>

				{/* BUTTONS */}
				<div className="flex items-center gap-4 mt-4">
					<button
						onClick={() => router.push("/dashboard/calendar")}
						className="bg-black text-white px-5 py-[10px] rounded-full text-[14px] hover:bg-gray-800 transition"
					>
						View Calendar
					</button>

					<button
						onClick={onDone}
						className="border border-[#CECECE] text-[#2B2B2B] px-5 py-[10px] rounded-full text-[14px] hover:bg-gray-50 transition"
					>
						Done
					</button>

					{actionType === "rescheduled" && (
						<button
							onClick={onSuggestOther}
							className="text-[#735FF8] text-[14px] font-medium underline hover:text-[#6350E0] transition"
						>
							Suggest other time slots
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
