/** @format */
"use client";

import Image from "next/image";

export default function RecommendationPanel({
	onAccept,
	briefText,
	temperatureC,
	weatherCondition,
	isWeatherLoading,
	events = [],
	nextEvent,
	totalEvents,
	totalTeams,
	emailImportant,
	gmailCount,
	outlookCount,
	totalUnread,
}: {
	onAccept: () => void;
	briefText?: string;
	temperatureC?: number | null;
	weatherCondition?: string | null;
	isWeatherLoading?: boolean;

	// Event data
	events?: {
		id: string;
		title: string;
		timeRange: string;
		meetingLink?: string | null;
		provider?: string | null; // Meeting provider (google-meet, microsoft-teams, zoom)
		calendar_provider?: string | null;
	}[];

	nextEvent?: {
		summary: string;
		start: string;
		duration: number;
	};

	totalEvents?: number;
	totalTeams?: number;

	// Email data
	emailImportant?: number;
	gmailCount?: number;
	outlookCount?: number;
	totalUnread?: number;
}) {
	const parseBriefText = (text: string) =>
		text.split("\n").filter((line) => line.trim());

	const briefLines = briefText ? parseBriefText(briefText) : [];

	return (
		<div
			className="
        bg-white
        rounded-[24px]
        border border-[#E5E5E5]
        shadow-[0_4px_12px_rgba(0,0,0,0.04)]
        p-8
        w-full
        max-w-[900px]
        mx-auto
        space-y-6
      "
		>
			{/* HEADER */}
			<div>
				<p className="text-[20px] font-normal text-[#1F1F1F] mb-4">
					Prepared your morning brief
				</p>

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
								Suggested optimal meeting time.
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
								Processed daily brief.
							</p>
						</div>
					</div>
				</div>

				<div className="mt-[10px] flex items-center gap-1 cursor-pointer group w-fit ml-[24px]">
					<p className="text-[14px] font-light text-[#735FF8] group-hover:underline underline-offset-2">
						See More
					</p>

					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						className="transition group-hover:translate-y-[1px]"
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
			</div>

			<div className="border-t border-[#E1E2E5]" />

			{/* SUMMARY */}
			<div className="mt-2">
				<p className="text-[20px] font-normal text-[#1F1F1F] mb-2">Summary</p>

				<div className="border-l-[1px] border-[#382099] pl-[24px] space-y-[4px]">
					{briefLines.map((line, index) => (
						<p
							key={index}
							className="text-[16px] leading-[1.45] text-[#1F1F1F]"
						>
							{line}
						</p>
					))}
				</div>
			</div>

			<div className="border-t border-[#E1E2E5]" />

			{/* EVENTS */}
			<div className="space-y-3">
				<p className="text-[20px] font-normal text-[#1F1F1F]">
					{totalEvents ?? 0} Events
				</p>

				{(() => {
					// Calculate Teams count dynamically from events
					const teamsCount =
						events?.filter((ev) => {
							const link = ev.meetingLink || "";
							const provider = ev.provider || "";
							return (
								link.includes("teams.microsoft.com") ||
								link.includes("teams.live.com") ||
								provider === "microsoft-teams"
							);
						}).length || 0;

					if (teamsCount > 0) {
						return (
							<p className="flex items-center gap-2 text-[14px] text-[#6A6A6A]">
								<Image
									src="/Icons/logos_microsoft-teams.svg"
									alt="teams"
									width={18}
									height={18}
								/>
								{teamsCount} Teams
							</p>
						);
					}
					return null;
				})()}

				{/* Next Event */}
				{nextEvent && (
					<p className="text-[14px] text-[#1F1F1F]">
						<span className="text-[#735FF8]">•</span> Next Event:{" "}
						<span className="font-semibold">{nextEvent.summary}</span>
					</p>
				)}

				{/* Event Cards */}
				<div className="space-y-3">
					{events?.map((ev) => {
						// Determine icon based on meeting link/provider
						// Note: calendar_provider (google/outlook) is NOT used for icon selection
						// Only meeting links and meeting providers determine the icon
						const getEventIcon = () => {
							const link = (ev.meetingLink || "").toLowerCase();
							const provider = (ev.provider || "").toLowerCase();

							// Check link first (case-insensitive) - only for actual meeting links
							if (
								link.includes("meet.google.com") ||
								link.includes("hangouts.google.com") ||
								link.includes("google.com/meet")
							) {
								return "/Icons/logos_google-meet.svg";
							} else if (
								link.includes("teams.microsoft.com") ||
								link.includes("teams.live.com") ||
								link.includes("microsoft.com/teams")
							) {
								return "/Icons/logos_microsoft-teams.svg";
							} else if (
								link.includes("zoom.us") ||
								link.includes("zoom.com")
							) {
								return "/Icons/fluent_person-16-filled.svg";
							}

							// Fallback to provider field (case-insensitive) - only for meeting providers
							// Only check for specific meeting provider names, not generic "google" or "outlook"
							if (provider === "google-meet") {
								return "/Icons/logos_google-meet.svg";
							} else if (
								provider === "microsoft-teams" ||
								provider === "teams"
							) {
								return "/Icons/logos_microsoft-teams.svg";
							} else if (provider === "zoom") {
								return "/Icons/fluent_person-16-filled.svg";
							}

							// Default: no meeting link or provider (personal event)
							// Always use person icon for events without meeting links
							return "/Icons/fluent_person-16-filled.svg";
						};

						return (
							<div
								key={ev.id}
								className="w-full rounded-xl border border-[#E1E2E5] p-4 flex items-center gap-3"
							>
								<Image
									src={getEventIcon()}
									alt="event"
									width={28}
									height={28}
									className="min-w-[28px]"
								/>

								<div className="flex flex-col">
									<p className="text-[16px] font-light text-[#1F1F1F]">
										{ev.title}
									</p>
									<p className="text-[14px] text-[#6A6A6A]">{ev.timeRange}</p>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<div className="border-t border-[#E1E2E5]" />

			{/* EMAIL SUMMARY */}
			<div className="space-y-3">
				<p className="text-[20px] font-normal text-[#1F1F1F]">
					{emailImportant ?? 0} Important Emails
				</p>

				<div className="flex items-center gap-4 text-[15px] text-[#1F1F1F]">
					<div className="flex items-center gap-1">
						<Image src="/Icons/Gmail.png" alt="gmail" width={20} height={20} />
						{gmailCount ?? 0} Gmail
					</div>

					<div className="flex items-center gap-1">
						<Image
							src="/Icons/outlook.png"
							alt="outlook"
							width={20}
							height={20}
						/>
						{outlookCount ?? 0} Outlook
					</div>
				</div>

				<p className="text-[14px] text-[#6A6A6A]">
					{totalUnread ?? 0} total unread in your inbox
				</p>
			</div>

			<div className="border-t border-[#E1E2E5]" />
			{/* FOOTER BUTTONS */}
			<div className="flex justify-end gap-4 pt-4">
				<button
					onClick={() => {
						if (briefText) {
							window.dispatchEvent(
								new CustomEvent("miraSpeak", { detail: { text: briefText } })
							);
						}
					}}
					className="px-6 py-2 rounded-full border border-[#CFCFCF] text-[#1F1F1F] font-light"
				>
					Repeat
				</button>

				<button
					onClick={() => {
						window.dispatchEvent(
							new CustomEvent("miraSpeak", {
								detail: { text: "Okay, finishing your brief." },
							})
						);
						onAccept();
					}}
					className="px-6 py-2 rounded-full bg-[#1F1F1F] text-white font-light"
				>
					Finish
				</button>
			</div>
		</div>
	);
}
