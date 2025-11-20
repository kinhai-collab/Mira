/** @format */

import { Icon } from "@/components/Icon";
import Image from "next/image";
import React from "react";

export type VoiceSummaryStepStatus = "pending" | "active" | "done" | "disabled";

export interface VoiceSummaryStep {
	id: string;
	label: string;
	status: VoiceSummaryStepStatus;
}

export interface VoiceSummaryEmail {
	id: string;
	from: string;
	senderEmail?: string;
	subject: string;
	receivedAt: string;
	summary?: string;
}

export type CalendarEventProvider = "google-meet" | "microsoft-teams" | "other";

export interface VoiceSummaryCalendarEvent {
	id: string;
	title: string;
	timeRange: string;
	location?: string;
	note?: string;
	meetingLink?: string | null;
	provider?: CalendarEventProvider | string | null;
}

export interface EmailCalendarOverlayProps {
	visible: boolean;
	stage: "thinking" | "summary";
	steps: VoiceSummaryStep[];
	emails?: VoiceSummaryEmail[];
	calendarEvents?: VoiceSummaryCalendarEvent[];
	focusNote?: string | null;
	isMuted: boolean;
	onMuteToggle?: () => void;
	chips?: {
		dateLabel?: string;
		locationLabel?: string;
		temperatureLabel?: string;
	};
	showContextChips?: boolean;
	showControls?: boolean;
}

function stepTextColor(status: VoiceSummaryStepStatus) {
	switch (status) {
		case "done":
			return "text-[#272829]";
		case "active":
			return "text-[#272829]";
		case "pending":
			return "text-[#454547]";
		case "disabled":
			return "text-[#96989c]";
		default:
			return "text-[#272829]";
	}
}

function StepBullet({ status }: { status: VoiceSummaryStepStatus }) {
	if (status === "done") {
		return (
			<span className="flex size-4 items-center justify-center rounded-full bg-[#382099] text-[10px] font-semibold text-white">
				✓
			</span>
		);
	}

	if (status === "active") {
		return (
			<span className="flex size-4 items-center justify-center rounded-full border-2 border-[#382099]">
				<span className="size-1.5 rounded-full bg-[#382099]" />
			</span>
		);
	}

	if (status === "disabled") {
		return (
			<span className="flex size-4 items-center justify-center rounded-full border border-[#d5d8df] bg-[#eceff6]" />
		);
	}

	return (
		<span className="flex size-4 items-center justify-center rounded-full border border-[#c4c6cc]" />
	);
}

const GMAIL_ICON = { src: "/Icons/image 4.png", alt: "Gmail" };
const OUTLOOK_ICON = { src: "/Icons/image 5.png", alt: "Outlook" };
const DEFAULT_EMAIL_ICON = { src: "/Icons/Property 1=Email.svg", alt: "Email" };
const GOOGLE_MEET_PROVIDER = {
	type: "meet" as const,
	label: "Meet",
	icon: { src: "/Icons/logos_google-meet.svg", alt: "Google Meet" },
};
const MICROSOFT_TEAMS_PROVIDER = {
	type: "teams" as const,
	label: "Teams",
	icon: { src: "/Icons/logos_microsoft-teams.svg", alt: "Microsoft Teams" },
};

function resolveEmailProviderIcon(from?: string) {
	if (!from) return DEFAULT_EMAIL_ICON;

	const normalized = from.toLowerCase();

	if (normalized.includes("@gmail.") || normalized.includes("@googlemail.")) {
		return GMAIL_ICON;
	}

	if (
		normalized.includes("@outlook.") ||
		normalized.includes("@hotmail.") ||
		normalized.includes("@live.") ||
		normalized.includes("@office365.") ||
		normalized.includes("@microsoft.")
	) {
		return OUTLOOK_ICON;
	}

	return DEFAULT_EMAIL_ICON;
}

type CalendarProvider =
	| typeof GOOGLE_MEET_PROVIDER
	| typeof MICROSOFT_TEAMS_PROVIDER;

function resolveCalendarEventProvider(
	event: VoiceSummaryCalendarEvent
): CalendarProvider | null {
	const explicit = (event.provider ?? "").toString().toLowerCase();
	if (explicit.includes("team")) {
		return MICROSOFT_TEAMS_PROVIDER;
	}
	if (explicit.includes("meet") || explicit.includes("google")) {
		return GOOGLE_MEET_PROVIDER;
	}

	const text = `${event.location ?? ""} ${event.note ?? ""} ${
		event.title ?? ""
	}`.toLowerCase();

	if (text.includes("google meet") || text.includes("meet.google")) {
		return GOOGLE_MEET_PROVIDER;
	}

	if (text.includes("microsoft teams") || text.includes("teams.microsoft")) {
		return MICROSOFT_TEAMS_PROVIDER;
	}

	if (text.includes("teams")) {
		return MICROSOFT_TEAMS_PROVIDER;
	}

	// Default to Google Meet styling for virtual meetings when nothing explicit is provided.
	if (text.includes("zoom") || text.includes("call") || text.includes("meet")) {
		return GOOGLE_MEET_PROVIDER;
	}

	return GOOGLE_MEET_PROVIDER;
}

function SummaryCard({
	emails,
	calendarEvents,
	focusNote,
	provider,
}: {
	emails?: VoiceSummaryEmail[];
	calendarEvents?: VoiceSummaryCalendarEvent[];
	focusNote?: string | null;
	provider?: string;
}) {
	const hasEmails = !!emails?.length;
	const hasEvents = !!calendarEvents?.length;

	const safeEmails: VoiceSummaryEmail[] = Array.isArray(emails) ? emails : [];

	// Use provided value or fallback
	const currentProvider = provider || "gmail";

	// Calculate 24-hour window
	const now = new Date();
	const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	// Filter only recent emails
	const recentEmails = safeEmails.filter((e) => {
		if (!e.receivedAt) return false;

		let receivedAt: Date | null = null;

		// Handle numeric timestamps or ISO strings safely
		if (!isNaN(Number(e.receivedAt))) {
			// If numeric timestamp (milliseconds)
			receivedAt = new Date(Number(e.receivedAt));
		} else {
			// If ISO string or Gmail RFC 2822 format
			const parsed = Date.parse(e.receivedAt);
			if (!isNaN(parsed)) receivedAt = new Date(parsed);
		}

		return receivedAt && receivedAt > twentyFourHoursAgo && receivedAt <= now;
	});
	// Use only recent emails for display and counts
	const emailsToShow = recentEmails;

	// Count Gmail and Outlook from recent emails
	let gmailCount = 0;
	let outlookCount = 0;

	if (currentProvider === "gmail") {
		gmailCount = emailsToShow.length;
	} else if (currentProvider === "outlook") {
		outlookCount = emailsToShow.length;
	}
	const unreadCount = emailsToShow.length
		? Math.ceil(emailsToShow.length * 0.6)
		: 0;
	// const outlookCount = emails?.length ? emails.length - gmailCount : 0;
	// const unreadCount = emails?.length ? Math.ceil(emails.length * 0.6) : 0;

	// Ensure calendarEvents is always an array
	const safeCalendarEvents: VoiceSummaryCalendarEvent[] = Array.isArray(
		calendarEvents
	)
		? calendarEvents
		: [];

	// Compute meeting counts safely
	const meetCount = safeCalendarEvents.filter(
		(event) => resolveCalendarEventProvider(event)?.type === "meet"
	).length;

	const teamsCount = safeCalendarEvents.filter(
		(event) => resolveCalendarEventProvider(event)?.type === "teams"
	).length;

	const nextEvent = safeCalendarEvents[0];
	// Email visibility controls
	const [visibleCount, setVisibleCount] = React.useState(6);
	const isAllVisible = visibleCount >= safeEmails.length;
	const displayedEmails = safeEmails.slice(0, visibleCount);

	return (
		<div className="w-full rounded-[24px] border border-[#e6e9f0] bg-white/85 p-6 text-left shadow-[0_8px_24px_rgba(39,40,41,0.08)] backdrop-blur">
			{hasEmails && (
				<>
					{/* Email Summary Header */}
					<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-end gap-2">
								<h3 className="font-['Outfit',sans-serif] text-[24px] font-medium leading-none text-[#272829]">
									{emailsToShow.length || 0}
								</h3>
								<span className="font-['Outfit',sans-serif] text-[20px] font-normal leading-none text-[#272829]">
									Important Emails
								</span>
							</div>
							<div className="flex items-center gap-1">
								<span className="font-['Outfit',sans-serif] text-[14px] font-light text-[#454547]">
									24 hours
								</span>
								<Icon
									name="ChevronRight"
									size={18}
									className="text-[#454547]"
								/>
							</div>
							<div className="mt-1 flex items-center gap-3">
								<div className="flex items-center gap-1">
									<Image
										src={GMAIL_ICON.src}
										alt={GMAIL_ICON.alt}
										width={20}
										height={20}
										className="h-5 w-5 object-contain"
									/>
									<span className="font-['Outfit',sans-serif] text-[16px] text-[#454547]">
										{gmailCount} Gmail
									</span>
								</div>
								<div className="flex items-center gap-1 border-l border-[#e6e9f0] pl-2">
									<Image
										src={OUTLOOK_ICON.src}
										alt={OUTLOOK_ICON.alt}
										width={20}
										height={20}
										className="h-5 w-5 object-contain"
									/>
									<span className="font-['Outfit',sans-serif] text-[16px] text-[#454547]">
										{outlookCount} Outlook
									</span>
								</div>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<div className="h-2 w-2 rounded-full bg-[#F16A6A]" />
							<span className="font-['Outfit',sans-serif] text-[14px] font-light text-[#454547]">
								{unreadCount} unread
							</span>
						</div>
					</div>

					{/* Email List - Two Columns */}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{/* Left Column */}
						<div className="flex flex-col gap-2">
							{displayedEmails
								.slice(0, Math.ceil(displayedEmails.length / 2))
								.map((email) => {
									const icon = resolveEmailProviderIcon(email.from);

									return (
										<div
											key={email.id}
											className="flex items-center gap-2 rounded-lg border border-[#e6e9f0] bg-white p-2 shadow-sm"
										>
											<div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e6e9f0] bg-white">
												<Image
													src={icon.src}
													alt={`${icon.alt} icon`}
													width={24}
													height={24}
													className="h-6 w-6 object-contain"
												/>
											</div>
											<div className="flex-1 overflow-hidden">
												<div className="flex items-center gap-1">
													<div className="h-2 w-2 shrink-0 rounded-full bg-[#F16A6A]" />
													<p className="font-['Outfit',sans-serif] truncate text-[14px] font-medium text-[#272829]">
														{email.subject}
													</p>
												</div>
												<p className="font-['Outfit',sans-serif] ml-3 truncate text-[14px] font-light text-[#454547]">
													From:{" "}
													{email?.from
														? email.from.includes("<")
															? email.from.split("<")[0].trim()
															: email.from.split("@")[0]
														: "Unknown Sender"}
												</p>
											</div>
										</div>
									);
								})}
						</div>

						{/* Right Column */}
						<div className="flex flex-col gap-2">
							{displayedEmails
								.slice(Math.ceil(displayedEmails.length / 2))
								.map((email) => {
									const icon = resolveEmailProviderIcon(email.from);

									return (
										<div
											key={email.id}
											className="flex items-center gap-2 rounded-lg border border-[#e6e9f0] bg-white p-2 shadow-sm"
										>
											<div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e6e9f0] bg-white">
												<Image
													src={icon.src}
													alt={`${icon.alt} icon`}
													width={24}
													height={24}
													className="h-6 w-6 object-contain"
												/>
											</div>
											<div className="flex-1 overflow-hidden">
												<div className="flex items-center gap-1">
													<div className="h-2 w-2 shrink-0 rounded-full bg-[#F16A6A]" />
													<p className="font-['Outfit',sans-serif] truncate text-[14px] font-medium text-[#272829]">
														{email.subject}
													</p>
												</div>
												<p className="font-['Outfit',sans-serif] ml-3 truncate text-[14px] font-light text-[#454547]">
													From:{" "}
													{email?.from
														? email.from.includes("<")
															? email.from.split("<")[0].trim()
															: email.from.split("@")[0]
														: "Unknown Sender"}
												</p>
											</div>
										</div>
									);
								})}
						</div>
					</div>
					{safeEmails.length > 6 && (
						<div className="mt-6 flex justify-center gap-4">
							{/* Show More button */}
							{visibleCount < safeEmails.length && (
								<button
									onClick={() =>
										setVisibleCount((prev) =>
											Math.min(prev + 6, safeEmails.length)
										)
									}
									className="text-[#382099] font-medium text-sm hover:underline"
								>
									Show More
								</button>
							)}

							{/* Show All button */}
							{!isAllVisible && (
								<button
									onClick={() => setVisibleCount(safeEmails.length)}
									className="text-[#382099] font-medium text-sm hover:underline"
								>
									Show All
								</button>
							)}

							{/* Show Less button */}
							{visibleCount > 6 && (
								<button
									onClick={() => setVisibleCount(6)}
									className="text-[#382099] font-medium text-sm hover:underline"
								>
									Show Less
								</button>
							)}
						</div>
					)}
				</>
			)}

			{/* Show "No emails" state only when nothing else is available */}
			{!hasEmails && !hasEvents && (
				<div className="rounded-2xl border border-dashed border-[#d6d9e1] bg-white/60 p-6 text-center text-sm text-[#5a5c61]">
					No priority emails detected right now.
				</div>
			)}

			{/* Calendar section (if there are calendar events) */}
			{hasEvents && (
				<div
					className={`${
						hasEmails ? "mt-8 border-t border-[#e6e9f0] pt-6" : ""
					}`}
				>
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex flex-wrap items-start gap-6">
							<div className="flex flex-col gap-2">
								<div className="flex items-end gap-2">
									<h3 className="font-['Outfit',sans-serif] text-[24px] font-medium leading-none text-[#272829]">
										{calendarEvents?.length || 0}
									</h3>
									<span className="font-['Outfit',sans-serif] text-[20px] font-normal leading-none text-[#272829]">
										Events
									</span>
								</div>
								<div className="flex items-center gap-1">
									<span className="font-['Outfit',sans-serif] text-[14px] font-light text-[#454547]">
										24 hours
									</span>
									<Icon
										name="ChevronRight"
										size={18}
										className="text-[#454547]"
									/>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-3">
								<div className="flex items-center gap-2 rounded-full border border-[#e6e9f0] bg-white px-3 py-1 shadow-[0_2px_8px_rgba(39,40,41,0.04)]">
									<Image
										src={GOOGLE_MEET_PROVIDER.icon.src}
										alt={GOOGLE_MEET_PROVIDER.icon.alt}
										width={22}
										height={22}
										className="h-[18px] w-[22px] object-contain"
									/>
									<span className="font-['Outfit',sans-serif] text-[16px] text-[#454547]">
										{meetCount} {GOOGLE_MEET_PROVIDER.label}
									</span>
								</div>
								<div className="flex items-center gap-2 rounded-full border border-[#e6e9f0] bg-white px-3 py-1 shadow-[0_2px_8px_rgba(39,40,41,0.04)]">
									<Image
										src={MICROSOFT_TEAMS_PROVIDER.icon.src}
										alt={MICROSOFT_TEAMS_PROVIDER.icon.alt}
										width={22}
										height={22}
										className="h-[21px] w-[22px] object-contain"
									/>
									<span className="font-['Outfit',sans-serif] text-[16px] text-[#454547]">
										{teamsCount} {MICROSOFT_TEAMS_PROVIDER.label}
									</span>
								</div>
							</div>
						</div>

						{nextEvent && (
							<div className="flex flex-wrap items-center gap-2 text-[14px]">
								<span className="inline-flex size-2 rounded-full bg-[#5d8bff]" />
								<span className="font-['Outfit',sans-serif] text-[#454547]">
									Next Event:
								</span>
								<span className="font-['Outfit',sans-serif] font-medium text-[#272829]">
									{nextEvent.title}
								</span>
							</div>
						)}
					</div>

					<div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
						{calendarEvents?.map((event) => {
							const provider = resolveCalendarEventProvider(event);
							const detailSegments = [
								event.timeRange,
								event.note,
								event.location,
							].filter(Boolean) as string[];
							const hasSegments = detailSegments.length > 0;

							return (
								<div
									key={event.id}
									className="flex h-full gap-3 rounded-[18px] border border-[#e6e9f0] bg-white p-5 shadow-[0_8px_18px_rgba(39,40,41,0.05)] transition hover:shadow-md"
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#eceff4] bg-[#f5f7fb]">
										{provider ? (
											<Image
												src={provider.icon.src}
												alt={`${provider.icon.alt} icon`}
												width={22}
												height={22}
												className="h-5 w-5 object-contain"
											/>
										) : (
											<Icon
												name="Calendar"
												size={20}
												className="text-[#735ff8]"
											/>
										)}
									</div>

									<div className="flex-1 space-y-2">
										<div className="flex items-start justify-between gap-2">
											<div className="flex items-start gap-2 flex-1">
												<span className="mt-[6px] inline-flex size-2 shrink-0 rounded-full bg-[#6a80ff]" />
												<p className="font-['Outfit',sans-serif] text-[14px] font-medium text-[#272829]">
													{event.title}
												</p>
											</div>
											{event.meetingLink && (
												<a
													href={event.meetingLink}
													target="_blank"
													rel="noopener noreferrer"
													className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-[#382099] rounded-md hover:bg-[#2d1a7a] transition-colors"
												>
													Join
													<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
														<path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
														<path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
													</svg>
												</a>
											)}
										</div>
										{hasSegments && (
											<div className="flex flex-wrap items-center gap-2 text-[13px] font-light text-[#5a5c61]">
												{detailSegments.map((segment, index) => (
													<React.Fragment key={`${event.id}-segment-${index}`}>
														{index !== 0 && (
															<span className="inline-block h-3 w-px bg-[#e6e9f0]" />
														)}
														<span>{segment}</span>
													</React.Fragment>
												))}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{focusNote && (
				<div className="mt-6 rounded-2xl border border-[#382099]/15 bg-[#f7f4ff] p-4 text-[#272829]">
					<p className="text-sm font-semibold text-[#382099]">
						Suggested focus
					</p>
					<p className="mt-2 text-sm text-[#454547]">{focusNote}</p>
				</div>
			)}
		</div>
	);
}

export function EmailCalendarOverlay({
	visible,
	stage,
	steps,
	emails,
	calendarEvents,
	focusNote,
	isMuted,
	onMuteToggle,
	chips,
	showContextChips = true,
	showControls = true,
}: EmailCalendarOverlayProps) {
	if (!visible) return null;

	const statusHeading = stage === "summary" ? "Summary ready" : "Thinking...";
	const description =
		stage === "summary"
			? "Summarized your emails and events."
			: "Summarizing your emails and events...";

	const shouldShowChips = showContextChips && !!chips;

	return (
		<div className="w-full max-w-[840px] space-y-6 text-[#272829]">
			<div
				className={`flex flex-wrap items-center gap-3 ${
					shouldShowChips ? "justify-between" : "justify-end"
				}`}
			>
				{shouldShowChips && chips && (
					<div className="flex flex-wrap items-center gap-3 text-sm">
						{chips.dateLabel && (
							<span className="rounded-full bg-white px-4 py-1 font-medium shadow-[0_2px_8px_rgba(39,40,41,0.04)]">
								{chips.dateLabel}
							</span>
						)}
						{chips.locationLabel && (
							<span className="flex items-center gap-2 rounded-full border border-[#e6e9f0] bg-white px-4 py-1 shadow-[0_2px_8px_rgba(39,40,41,0.04)]">
								<Icon name="Location" size={16} />
								{chips.locationLabel}
							</span>
						)}
						{chips.temperatureLabel && (
							<span className="flex items-center gap-2 rounded-full border border-[#e6e9f0] bg-white px-4 py-1 shadow-[0_2px_8px_rgba(39,40,41,0.04)]">
								<Icon name="Sun" size={18} />
								{chips.temperatureLabel}
							</span>
						)}
					</div>
				)}

				{showControls && (
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 rounded-full border border-[#e6e9f0] bg-[#fdedf7] px-4 py-1.5 text-sm font-medium text-[#272829] shadow-[0_2px_8px_rgba(39,40,41,0.04)]">
							<Icon name="Brain" size={18} />
							Smart Summary
						</div>
						<button
							type="button"
							onClick={onMuteToggle}
							disabled={!onMuteToggle}
							className="flex items-center gap-2 rounded-full border border-[#454547] bg-[#454547] px-4 py-1.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(39,40,41,0.08)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<Icon
								name={isMuted ? "VoiceOff" : "VoiceOn"}
								size={18}
								className="invert"
							/>
							{isMuted ? "Muted" : "Mute"}
						</button>
					</div>
				)}
			</div>

			<div className="rounded-[24px] border border-[#e6e9f0] bg-white/80 p-6 shadow-[0_12px_36px_rgba(39,40,41,0.08)] backdrop-blur">
				<div className="flex items-center gap-3">
					<span className="flex size-3 rounded-full bg-[#382099]" />
					<p className="text-lg font-medium">{statusHeading}</p>
				</div>

				<p className="mt-5 text-lg font-semibold">{description}</p>

				<div className="mt-4 border-l border-[#382099] pl-6">
					<ul className="flex flex-col gap-3">
						{steps.map((step) => (
							<li
								key={step.id}
								className={`flex items-center gap-3 ${stepTextColor(
									step.status
								)}`}
							>
								<StepBullet status={step.status} />
								<span className="text-sm">{step.label}</span>
							</li>
						))}
					</ul>
				</div>
			</div>

			{stage === "summary" && (
				<div className="mt-2">
					{/* Normalize emails safely before passing */}
					{(() => {
						// Define backend email types for normalization
						interface BackendEmail {
							id: string;
							sender_name?: string;
							sender_email?: string;
							from?: string;
							subject?: string;
							timestamp?: string;
							receivedAt?: string;
							snippet?: string;
							body?: string;
						}

						interface EmailsResponse {
							data?: {
								emails?: BackendEmail[];
								provider?: string;
							};
							provider?: string;
						}

						// Normalize backend email structure to match VoiceSummaryEmail interface
						type EmailBackendRecord = {
							id?: string;
							sender_name?: string;
							sender_email?: string;
							from?: string;
							subject?: string;
							timestamp?: string;
							receivedAt?: string;
							snippet?: string;
							body?: string;
						};

						const safeEmails: VoiceSummaryEmail[] = Array.isArray(emails)
							? emails.map((e: VoiceSummaryEmail | EmailBackendRecord) => {
									const backend = e as EmailBackendRecord;
									const fromVal = backend.from ?? backend.sender_name ?? backend.sender_email ?? "Unknown";
									const subjectVal = backend.subject ?? "No Subject";
									const receivedAtVal = backend.timestamp ?? backend.receivedAt ?? "";
									const idVal = backend.id ?? "";
									const senderEmailVal = backend.sender_email ?? "";
									const summaryVal = backend.snippet ?? backend.body ?? "";
									return {
										id: idVal,
										from: String(fromVal),
										senderEmail: String(senderEmailVal),
										subject: String(subjectVal),
										receivedAt: String(receivedAtVal),
										summary: String(summaryVal),
									} as VoiceSummaryEmail;
								})
							: [];

						const safeCalendarEvents: VoiceSummaryCalendarEvent[] =
							Array.isArray(calendarEvents) ? calendarEvents : [];
						const provider =
							(emails as EmailsResponse)?.provider ||
							(emails as EmailsResponse)?.data?.provider ||
							"gmail";

						return (
							<SummaryCard
								emails={safeEmails}
								calendarEvents={safeCalendarEvents}
								provider={provider}
								focusNote={focusNote}
							/>
						);
					})()}
				</div>
			)}
		</div>
	);
}
