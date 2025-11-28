/** @format */

import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";

interface CalendarModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (eventData: {
		summary: string;
		start: string;
		end: string;
		description?: string;
		location?: string;
		attendees?: string[];
	}) => void;
	initialDate?: Date;
}

export function CalendarModal({
	isOpen,
	onClose,
	onSave,
	initialDate,
}: CalendarModalProps) {
	const [title, setTitle] = useState("");
	const [type, setType] = useState<"meeting" | "team" | "personal">("meeting");
	const [date, setDate] = useState(initialDate || new Date());
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("10:00");
	const [startPeriod, setStartPeriod] = useState("AM");
	const [endPeriod, setEndPeriod] = useState("AM");

	// Reset form when modal opens/closes or initialDate changes
	useEffect(() => {
		if (isOpen) {
			setTitle("");
			setType("meeting");
			const baseDate = initialDate || new Date();
			setDate(baseDate);

			// Set default times based on initial date (if provided) or current time
			const defaultStart = new Date(baseDate);
			// If initialDate has a specific hour (from time slot click), use it; otherwise round to next 15 min
			if (initialDate && initialDate.getHours() !== undefined) {
				defaultStart.setHours(initialDate.getHours(), 0, 0);
			} else {
				defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 15) * 15); // Round to next 15 min
			}
			const defaultEnd = new Date(defaultStart);
			defaultEnd.setHours(defaultEnd.getHours() + 1);

			setStartTime(
				`${defaultStart.getHours().toString().padStart(2, "0")}:${defaultStart
					.getMinutes()
					.toString()
					.padStart(2, "0")}`
			);
			setEndTime(
				`${defaultEnd.getHours().toString().padStart(2, "0")}:${defaultEnd
					.getMinutes()
					.toString()
					.padStart(2, "0")}`
			);
		}
	}, [isOpen, initialDate]);

	if (!isOpen) return null;

	const handleSave = () => {
		if (!title.trim()) {
			alert("Please enter a title for the event");
			return;
		}

		// Construct start and end ISO strings
		const [startHour, startMin] = startTime.split(":").map(Number);
		const [endHour, endMin] = endTime.split(":").map(Number);

		const start = new Date(date);
		start.setHours(startHour, startMin, 0, 0);

		const end = new Date(date);
		end.setHours(endHour, endMin, 0, 0);

		// Validate that end time is after start time
		if (end <= start) {
			alert("End time must be after start time");
			return;
		}

		// Call onSave - parent will handle async operation and close modal on success
		onSave({
			summary: title.trim(),
			start: start.toISOString(),
			end: end.toISOString(),
			description: type, // Using description to store type for now
		});
	};

	const handleClose = () => {
		setTitle("");
		setType("meeting");
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
			<div className="bg-white rounded-xl shadow-xl w-[580px]  p-8 animate-fadeIn">
				{/* Title Input */}
				<input
					type="text"
					placeholder="Add Title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="w-full text-2xl font-light placeholder-gray-300 
border-b border-[#6A49ED] focus:border-[#6A49ED] 
focus:outline-none pb-2 mb-6 transition-colors"
					autoFocus
				/>

				{/* Type Tabs */}
				<div className="flex gap-4 mb-8">
					{["Meeting", "Team", "Personal"].map((t) => (
						<button
							key={t}
							onClick={() =>
								setType(t.toLowerCase() as "meeting" | "team" | "personal")
							}
							className={`px-4 py-2 rounded-[8px] text-sm font-light transition-all ${
								type === t.toLowerCase()
									? "bg-[#E0D9FC] text-[#6A49ED]"
									: "bg-white text-[#5D5E5F] hover:bg-[#E0D9FC] hover:text-[#6A49ED]"
							}`}
						>
							{t}
						</button>
					))}
				</div>

				{/* Date + Time Row */}
				<div className="mb-0 flex items-center justify-between">
					{/* Date */}
					<span className="text-[18px] font-light text-[#5D5E5F]">
						{date.toLocaleDateString("en-US", {
							weekday: "long",
							month: "long",
							day: "numeric",
						})}
					</span>

					{/* Time Inputs */}
					<div className="flex items-center gap-2">
						{/* START TIME */}
						<div className="flex items-center gap-1">
							<input
								type="text"
								value={startTime}
								onChange={(e) => setStartTime(e.target.value)}
								placeholder="08:00"
								className="w-[55px] text-[18px] font-light text-[#5D5E5F] outline-none bg-transparent"
							/>

							<select
								value={startPeriod}
								onChange={(e) => setStartPeriod(e.target.value)}
								className="text-[18px] font-light text-[#5D5E5F] bg-transparent outline-none"
							>
								<option>AM</option>
								<option>PM</option>
							</select>
						</div>

						<span className="text-[20px] font-light text-[#5D5E5F]">–</span>

						{/* END TIME */}
						<div className="flex items-center gap-1">
							<input
								type="text"
								value={endTime}
								onChange={(e) => setEndTime(e.target.value)}
								placeholder="09:00"
								className="w-[55px] text-[20px] font-light text-[#5D5E5F] outline-none bg-transparent"
							/>

							<select
								value={endPeriod}
								onChange={(e) => setEndPeriod(e.target.value)}
								className="text-[20px] font-light text-[#5D5E5F] bg-transparent outline-none"
							>
								<option>AM</option>
								<option>PM</option>
							</select>
						</div>
					</div>
				</div>

				{/* Subtitle */}
				<span className="text-sm text-[#7A7A7A]">
					Time Zone • Does not repeat
				</span>

				{/* Footer */}
				<div className="flex justify-end gap-3">
					<button
						onClick={handleClose}
						className="px-6 py-2 text-sm font-light text-gray-600 hover:bg-[#282829] hover:text-[#fff] rounded-full transition"
					>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={!title.trim()}
						className="px-8 py-2 bg-black text-[white] text-sm font-light rounded-full hover:bg-gray-800 transition shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
