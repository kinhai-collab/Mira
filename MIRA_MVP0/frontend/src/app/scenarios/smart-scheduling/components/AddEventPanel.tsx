/** @format */
"use client";

import Image from "next/image";
import { useState } from "react";

/* -------------------------------------------------
   PROPS
-------------------------------------------------- */
interface ConflictDetails {
	summary: string;
	start: string;
	end: string;
	provider: string;
	calendar: string;
}

interface Props {
	onSchedule: (eventData: {
		summary: string;
		start: Date;
		end: Date;
		description?: string;
		location?: string;
		attendees?: string[];
	}) => void;
	onCancel: () => void;
	isScheduling: boolean;
	conflictError?: {
		message: string;
		conflicts: ConflictDetails[];
	} | null;
}

/* -------------------------------------------------
   TIME OPTIONS
-------------------------------------------------- */
const generateTimeOptions = () => {
	const options: { value: string; label: string }[] = [];
	for (let h = 0; h < 24; h++) {
		for (let m = 0; m < 60; m += 30) {
			const hour = h.toString().padStart(2, "0");
			const minute = m.toString().padStart(2, "0");
			const value = `${hour}:${minute}`;

			const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
			const ampm = h < 12 ? "AM" : "PM";
			const label = `${hour12}:${minute.padStart(2, "0")} ${ampm}`;

			options.push({ value, label });
		}
	}
	return options;
};

const timeOptions = generateTimeOptions();

/* -------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------- */
export default function AddEventPanel({
	onSchedule,
	onCancel,
	isScheduling,
	conflictError,
}: Props) {
	const [title, setTitle] = useState("");
	const [date, setDate] = useState(() => {
		const today = new Date();
		return today.toISOString().split("T")[0];
	});
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("10:00");
	const [description, setDescription] = useState("");
	const [location, setLocation] = useState("");
	const [attendees, setAttendees] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);

	const handleSubmit = () => {
		if (!title.trim()) return;

		const startDate = new Date(`${date}T${startTime}:00`);
		const endDate = new Date(`${date}T${endTime}:00`);

		// Validate times
		if (endDate <= startDate) {
			alert("End time must be after start time");
			return;
		}

		const attendeeList = attendees
			.split(",")
			.map((e) => e.trim())
			.filter((e) => e && e.includes("@"));

		onSchedule({
			summary: title,
			start: startDate,
			end: endDate,
			description: description || undefined,
			location: location || undefined,
			attendees: attendeeList.length > 0 ? attendeeList : undefined,
		});
	};

	// Calculate duration
	const getDuration = () => {
		const [startH, startM] = startTime.split(":").map(Number);
		const [endH, endM] = endTime.split(":").map(Number);
		const startMinutes = startH * 60 + startM;
		const endMinutes = endH * 60 + endM;
		const diff = endMinutes - startMinutes;

		if (diff <= 0) return "--";
		if (diff < 60) return `${diff} min`;
		const hours = Math.floor(diff / 60);
		const mins = diff % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	};

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
			<p className="text-[20px] font-normal text-[#1F1F1F] mb-2">
				Schedule a new event
			</p>
			<p className="text-[14px] text-[#6B6B6B] mb-6">
				Add an event to your Google Calendar
			</p>

			{/* Conflict Error Banner */}
			{conflictError && (
				<div className="mb-6 p-4 bg-[#FDF0EF] border border-[#BE4B48] rounded-xl">
					<div className="flex items-start gap-3">
						<span className="text-lg">⚠️</span>
						<div>
							<p className="text-[15px] font-medium text-[#BE4B48] mb-2">
								{conflictError.message}
							</p>
							<div className="space-y-2">
								{conflictError.conflicts.map((c, idx) => (
									<div
										key={idx}
										className="text-[13px] text-[#6B6B6B] flex items-center gap-2"
									>
										<span className="w-2 h-2 rounded-full bg-[#BE4B48]"></span>
										<span>
											{c.summary} ({c.calendar}) -{" "}
											{new Date(c.start).toLocaleTimeString("en-US", {
												hour: "numeric",
												minute: "2-digit",
											})}
										</span>
									</div>
								))}
							</div>
							<p className="text-[13px] text-[#6B6B6B] mt-2">
								Please choose a different time.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Form */}
			<div className="space-y-5">
				{/* Title */}
				<div>
					<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
						Event Title *
					</label>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Meeting with team"
						className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition"
					/>
				</div>

				{/* Date */}
				<div>
					<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
						Date *
					</label>
					<input
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
						className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition"
					/>
				</div>

				{/* Time Selection */}
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
							Start Time *
						</label>
						<select
							value={startTime}
							onChange={(e) => setStartTime(e.target.value)}
							className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition bg-white"
						>
							{timeOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
							End Time *
						</label>
						<select
							value={endTime}
							onChange={(e) => setEndTime(e.target.value)}
							className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition bg-white"
						>
							{timeOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Duration display */}
				<div className="flex items-center gap-2 text-[14px] text-[#6B6B6B]">
					<Image
						src="/Icons/Property 1=Clock.svg"
						alt="Duration"
						width={16}
						height={16}
						className="opacity-70"
					/>
					<span>Duration: {getDuration()}</span>
				</div>

				{/* Advanced options toggle */}
				<button
					type="button"
					onClick={() => setShowAdvanced(!showAdvanced)}
					className="text-[14px] text-[#735FF8] font-medium hover:underline flex items-center gap-1"
				>
					{showAdvanced ? "Hide" : "Show"} additional options
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
					>
						<path
							d="M6 9L12 15L18 9"
							stroke="#735FF8"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>

				{/* Advanced options */}
				{showAdvanced && (
					<div className="space-y-5 pt-4 border-t border-gray-100">
						{/* Location */}
						<div>
							<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
								Location
							</label>
							<input
								type="text"
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								placeholder="Conference Room A or Zoom link"
								className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition"
							/>
						</div>

						{/* Description */}
						<div>
							<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
								Description
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Meeting agenda or notes..."
								rows={3}
								className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition resize-none"
							/>
						</div>

						{/* Attendees */}
						<div>
							<label className="block text-[14px] font-medium text-[#1F1F1F] mb-2">
								Attendees
							</label>
							<input
								type="text"
								value={attendees}
								onChange={(e) => setAttendees(e.target.value)}
								placeholder="email1@example.com, email2@example.com"
								className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#735FF8] transition"
							/>
							<p className="text-[12px] text-[#9B9B9B] mt-1">
								Separate multiple emails with commas
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Preview card */}
			{title && (
				<div className="mt-6 p-4 bg-[#F8F6FF] border border-[#735FF8] rounded-xl">
					<p className="text-[13px] text-[#735FF8] font-medium mb-2">
						Event Preview:
					</p>
					<p className="text-[16px] font-semibold text-[#1F1F1F]">{title}</p>
					<p className="text-[14px] text-[#6B6B6B]">
						{new Date(date).toLocaleDateString("en-US", {
							weekday: "short",
							month: "short",
							day: "numeric",
						})}{" "}
						• {timeOptions.find((t) => t.value === startTime)?.label} -{" "}
						{timeOptions.find((t) => t.value === endTime)?.label}
					</p>
					{location && (
						<p className="text-[13px] text-[#6B6B6B] mt-1">📍 {location}</p>
					)}
				</div>
			)}

			{/* Action buttons */}
			<div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
				<button
					onClick={handleSubmit}
					disabled={!title.trim() || isScheduling}
					className={`
						flex-1 px-5 py-[12px] rounded-full text-[15px] font-medium transition
						${
							title.trim() && !isScheduling
								? "bg-black text-white hover:bg-gray-800"
								: "bg-gray-200 text-gray-500 cursor-not-allowed"
						}
					`}
				>
					{isScheduling ? (
						<span className="flex items-center justify-center gap-2">
							<div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
							Creating Event...
						</span>
					) : (
						"Schedule Event"
					)}
				</button>

				<button
					onClick={onCancel}
					disabled={isScheduling}
					className="px-5 py-[12px] border border-[#CECECE] text-[#2B2B2B] rounded-full text-[15px] hover:bg-gray-50 transition disabled:opacity-50"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

