/** @format */
"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { EventItem } from "./types";

/* -------------------------------------------------
   PROPS
-------------------------------------------------- */
interface TimeSlot {
	start: Date;
	end: Date;
}

interface Props {
	eventToReschedule: EventItem;
	availableSlots: TimeSlot[];
	isLoadingSlots: boolean;
	onSelectSlot: (slot: TimeSlot) => void;
	onConfirmReschedule: (slot: TimeSlot) => void;
	onCancel: () => void;
	isRescheduling: boolean;
}

/* -------------------------------------------------
   TIME FORMATTING
-------------------------------------------------- */
function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function formatTimeRange(start: Date, end: Date): string {
	return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
}

/* -------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------- */
export default function ReschedulingPanel({
	eventToReschedule,
	availableSlots,
	isLoadingSlots,
	onSelectSlot,
	onConfirmReschedule,
	onCancel,
	isRescheduling,
}: Props) {
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
	const [customTime, setCustomTime] = useState<string>("");
	const [showCustomTime, setShowCustomTime] = useState(false);

	// Auto-select first slot if available
	useEffect(() => {
		if (availableSlots.length > 0 && !selectedSlot) {
			setSelectedSlot(availableSlots[0]);
			onSelectSlot(availableSlots[0]);
		}
	}, [availableSlots, selectedSlot, onSelectSlot]);

	const handleSlotSelect = (slot: TimeSlot) => {
		setSelectedSlot(slot);
		onSelectSlot(slot);
		setShowCustomTime(false);
	};

	const handleConfirm = () => {
		if (selectedSlot) {
			onConfirmReschedule(selectedSlot);
		}
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
				Rescheduling your meeting…
			</p>

			{/* Event being rescheduled */}
			<div className="bg-[#F8F6FF] border border-[#735FF8] rounded-xl px-4 py-3 mb-6">
				<p className="text-[13px] text-[#735FF8] font-medium mb-1">
					Event to reschedule:
				</p>
				<p className="text-[16px] font-semibold text-[#1F1F1F]">
					{eventToReschedule.title}
				</p>
				<p className="text-[14px] text-[#6B6B6B]">
					Currently: {eventToReschedule.time}
				</p>
			</div>

			{/* Progress indicators */}
			<div className="border-l-[1px] border-[#382099] pl-[24px] space-y-[4px] mb-6">
				<div className="flex items-center gap-3">
					<Image
						src="/Icons/Property 1=Done in circle.svg"
						alt="done"
						width={18}
						height={18}
					/>
					<p className="text-[15px] text-[#303030]">
						Checking available time slots…
					</p>
				</div>

				<div className="flex items-center gap-3">
					{isLoadingSlots ? (
						<div className="w-[18px] h-[18px] rounded-full border-2 border-[#735FF8] border-t-transparent animate-spin" />
					) : (
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={18}
							height={18}
						/>
					)}
					<p className="text-[15px] text-[#303030]">
						{isLoadingSlots
							? "Finding a common free window…"
							: `Found ${availableSlots.length} available slot${
									availableSlots.length !== 1 ? "s" : ""
							  }`}
					</p>
				</div>

				<div
					className={`flex items-center gap-3 ${
						!selectedSlot ? "opacity-60" : ""
					}`}
				>
					{selectedSlot ? (
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={18}
							height={18}
						/>
					) : (
						<div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300" />
					)}
					<p className="text-[15px] text-[#303030]">
						{selectedSlot ? "Time slot selected" : "Select a new time slot"}
					</p>
				</div>
			</div>

			{/* Available time slots */}
			{!isLoadingSlots && (
				<div className="mb-6">
					<p className="text-[16px] font-semibold text-[#1F1F1F] mb-3">
						Available Time Slots
					</p>
					<p className="text-[14px] text-[#6B6B6B] mb-4">
						{formatDate(availableSlots[0]?.start || new Date())}
					</p>

					<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
						{availableSlots.map((slot, idx) => (
							<button
								key={idx}
								onClick={() => handleSlotSelect(slot)}
								className={`
									px-4 py-3 rounded-xl border text-[14px] font-medium transition-all
									${
										selectedSlot === slot
											? "border-[#735FF8] bg-[#F8F6FF] text-[#735FF8]"
											: "border-gray-200 bg-white text-[#1F1F1F] hover:border-[#735FF8] hover:bg-[#FAFAFA]"
									}
								`}
							>
								{formatTimeRange(slot.start, slot.end)}
							</button>
						))}
					</div>

					{availableSlots.length === 0 && (
						<div className="text-center py-8 text-[#6B6B6B]">
							<p>No available slots found for today.</p>
							<p className="text-[13px] mt-1">
								Try checking another day or manually enter a time.
							</p>
						</div>
					)}

					{/* Custom time option */}
					<button
						onClick={() => setShowCustomTime(!showCustomTime)}
						className="mt-4 text-[14px] text-[#735FF8] font-medium hover:underline"
					>
						{showCustomTime ? "Hide custom time" : "Enter custom time →"}
					</button>

					{showCustomTime && (
						<div className="mt-4 p-4 bg-gray-50 rounded-xl">
							<label className="block text-[14px] text-[#1F1F1F] mb-2">
								Custom start time:
							</label>
							<input
								type="datetime-local"
								value={customTime}
								onChange={(e) => setCustomTime(e.target.value)}
								className="w-full px-4 py-2 border border-gray-200 rounded-lg text-[14px] focus:outline-none focus:border-[#735FF8]"
							/>
							<button
								onClick={() => {
									if (customTime) {
										const start = new Date(customTime);
										// Calculate end time based on original event duration
										const originalStart = eventToReschedule.startDate;
										const originalEnd = eventToReschedule.endDate;
										let duration = 60 * 60 * 1000; // Default 1 hour
										if (originalStart && originalEnd) {
											duration =
												originalEnd.getTime() - originalStart.getTime();
										}
										const end = new Date(start.getTime() + duration);
										const customSlot = { start, end };
										setSelectedSlot(customSlot);
										onSelectSlot(customSlot);
									}
								}}
								disabled={!customTime}
								className="mt-3 px-4 py-2 bg-[#735FF8] text-white rounded-lg text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Use this time
							</button>
						</div>
					)}
				</div>
			)}

			{/* Loading state for slots */}
			{isLoadingSlots && (
				<div className="mb-6">
					<div className="animate-pulse">
						<div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
						<div className="grid grid-cols-3 gap-3">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<div key={i} className="h-12 bg-gray-200 rounded-xl"></div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Action buttons */}
			<div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
				<button
					onClick={handleConfirm}
					disabled={!selectedSlot || isRescheduling}
					className={`
						flex-1 px-5 py-[12px] rounded-full text-[15px] font-medium transition
						${
							selectedSlot && !isRescheduling
								? "bg-black text-white hover:bg-gray-800"
								: "bg-gray-200 text-gray-500 cursor-not-allowed"
						}
					`}
				>
					{isRescheduling ? (
						<span className="flex items-center justify-center gap-2">
							<div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
							Rescheduling...
						</span>
					) : (
						"Confirm Reschedule"
					)}
				</button>

				<button
					onClick={onCancel}
					disabled={isRescheduling}
					className="px-5 py-[12px] border border-[#CECECE] text-[#2B2B2B] rounded-full text-[15px] hover:bg-gray-50 transition disabled:opacity-50"
				>
					Cancel
				</button>
			</div>

			{/* Selected slot preview */}
			{selectedSlot && (
				<div className="mt-4 p-3 bg-[#F0FFF4] border border-[#95D6A4] rounded-xl">
					<p className="text-[14px] text-[#1F1F1F]">
						<span className="text-[#22C55E] mr-2">✓</span>
						New time: <strong>{formatTimeRange(selectedSlot.start, selectedSlot.end)}</strong>
					</p>
				</div>
			)}
		</div>
	);
}
