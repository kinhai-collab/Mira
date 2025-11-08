/** @format */
// @ts-nocheck

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Helper: Generate days for a given month
const generateCalendarDays = (year, month) => {
	const firstDay = new Date(year, month, 1).getDay();
	const totalDays = new Date(year, month + 1, 0).getDate();
	const days = [];
	for (let i = 0; i < firstDay; i++) days.push(null);
	for (let i = 1; i <= totalDays; i++) days.push(i);
	return days;
};

export default function EmailsPage() {
	const router = useRouter();

	const [activeTab, setActiveTab] = useState("All");
	const [showCalendar, setShowCalendar] = useState(false);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedEmail, setSelectedEmail] = useState(null);
	const [showEmailPopup, setShowEmailPopup] = useState(false);

	const emails = [
		{
			name: "John Mayer",
			subject: "Q4 Budget Review",
			time: "18m ago",
			priority: "high",
		},
		{
			name: "Michael Brown",
			subject: "User Feedback Analysis",
			time: "30m ago",
			priority: "medium",
		},
		{
			name: "Alice Smith",
			subject: "Product Launch Plan",
			time: "45m ago",
			priority: "medium",
		},
		{
			name: "Lisa Park",
			subject: "Design Review",
			time: "1h ago",
			priority: "low",
		},
		{
			name: "Marcus Law",
			subject: "Roadmap Review",
			time: "1h ago",
			priority: "high",
		},
		{
			name: "Tom Wilson",
			subject: "Weekly Report",
			time: "1h ago",
			priority: "medium",
		},
		{
			name: "Rachel Green",
			subject: "Marketing Campaign",
			time: "2h ago",
			priority: "low",
		},
		{
			name: "David Lee",
			subject: "HR Policy Update",
			time: "3h ago",
			priority: "low",
		},
	];

	const colorMap = {
		high: { bar: "#F16A6A", bg: "#FDE7E7", text: "#D94C4C" },
		medium: { bar: "#FABA2E", bg: "#FFF4DB", text: "#E5A100" },
		low: { bar: "#95D6A4", bg: "#E7F8EB", text: "#49A15A" },
	};

	const filteredEmails =
		activeTab === "All"
			? emails
			: emails.filter((e) => e.priority === activeTab.toLowerCase());

	const today = new Date();
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();
	const days = generateCalendarDays(year, month);

	const handleDateClick = (day) => {
		if (!day) return;
		const newDate = new Date(year, month, day);
		setSelectedDate(newDate);
		setShowCalendar(false);
		console.log("Selected Date:", newDate.toDateString());
	};

	return (
		<div className="flex flex-col min-h-screen bg-[#F8F8FB] text-gray-800 p-8 relative">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between mb-8">
				<div className="flex flex-wrap items-center gap-3 text-gray-600 text-sm">
					<span className="font-normal">
						{today.toLocaleDateString("en-US", {
							weekday: "short",
							month: "short",
							day: "numeric",
						})}
					</span>

					<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
						<Image
							src="/Icons/Property 1=Location.svg"
							alt="Location"
							width={14}
							height={14}
						/>
						<span>New York</span>
					</span>

					<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Weather"
							width={14}
							height={14}
						/>
						<span>20°</span>
					</span>
				</div>

				<span className="text-gray-400 text-sm font-normal">
					{today.toLocaleTimeString("en-US", {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			</div>

			{/* Title */}
			<div className="mb-8">
				<h1 className="text-[26px] font-normal text-gray-900">Emails</h1>
				<p className="text-gray-600 mt-1 font-normal">
					Check your emails Mira is working on.
				</p>

				<button
					onClick={() => router.push("/dashboard")}
					className="mt-4 flex items-center gap-2 text-gray-800 text-[15px] font-normal hover:opacity-70 transition"
				>
					<Image
						src="/Icons/Property 1=ChevronLeft.svg"
						alt="Back"
						width={18}
						height={18}
						className="opacity-90"
					/>
					<span>Dashboard</span>
				</button>
			</div>

			{/* Emails Container */}
			<div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-sm overflow-hidden relative">
				{/* Header Row */}
				<div className="flex justify-between items-center px-6 py-5 border-b border-[#E7E7E7] bg-[#F8F9FB]">
					<div className="flex items-center gap-4">
						<p className="text-[16px] text-gray-800 font-normal">
							12 Important Emails
						</p>
						<div className="flex items-center gap-2">
							<span className="text-[13px] bg-[#F16A6A] text-white px-3 py-[3px] rounded-full font-normal">
								High: {emails.filter((e) => e.priority === "high").length}
							</span>
							<span className="text-[13px] bg-[#FABA2E] text-white px-3 py-[3px] rounded-full font-normal">
								Medium: {emails.filter((e) => e.priority === "medium").length}
							</span>
							<span className="text-[13px] bg-[#95D6A4] text-white px-3 py-[3px] rounded-full font-normal">
								Low: {emails.filter((e) => e.priority === "low").length}
							</span>
						</div>
					</div>

					{/* Calendar */}
					<div
						className="relative flex items-center gap-1 text-gray-500 text-[14px] cursor-pointer hover:text-[#62445E]"
						onClick={() => setShowCalendar(!showCalendar)}
					>
						<Image
							src="/Icons/Property 1=Calendar.svg"
							alt="Calendar"
							width={16}
							height={16}
						/>
						<span>
							{selectedDate.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>

						{/* Calendar Popup */}
						{showCalendar && (
							<div
								className="absolute right-0 top-8 mt-2 flex flex-col items-start border border-[#E6E9F0] rounded-[8px] bg-[#FFFFFF] p-[20px] shadow-sm z-50"
								style={{ width: "fit-content", minWidth: "320px" }}
							>
								{/* Month Header */}
								<div className="text-[16px] font-medium text-[#000000] mb-[8px]">
									{selectedDate.toLocaleDateString("en-US", {
										month: "long",
										year: "numeric",
									})}
								</div>

								{/* Weekdays Row */}
								<div className="grid grid-cols-7 w-full text-center text-[14px] text-[#000000] mb-[4px] font-normal">
									{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, i) => (
										<div key={i} className="py-[4px]">
											{day}
										</div>
									))}
								</div>

								{/* Dates Grid */}
								<div className="grid grid-cols-7 w-full text-center gap-x-[4px] gap-y-[6px] font-normal">
									{days.map((day, i) => {
										if (!day) {
											return (
												<div
													key={i}
													className="flex justify-center items-center text-[14px] text-[#BFBFBF] w-[40px] h-[36px]"
												>
													{" "}
												</div>
											);
										}

										const isSelected = day === selectedDate.getDate();

										return (
											<div
												key={i}
												onClick={() => handleDateClick(day)}
												className={`flex justify-center items-center text-[14px] rounded-[8px] h-[36px] w-[40px] cursor-pointer transition-all
              ${
								isSelected
									? "bg-[#444444] text-[#E5E5E5]"
									: "hover:bg-[#E6E6E6] text-[#000000]"
							}`}
											>
												{day}
											</div>
										);
									})}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Tabs */}
				<div className="flex border-b border-[#E7E7E7] text-[15px] text-gray-500">
					{["All", "High", "Medium", "Low"].map((tab, i) => (
						<div
							key={i}
							onClick={() => setActiveTab(tab)}
							className={`px-12 py-4 cursor-pointer text-center transition-all ${
								activeTab === tab
									? "text-[#62445E] border-b-[2px] border-[#62445E] bg-white"
									: "hover:bg-[#F9F9FC]"
							}`}
						>
							{tab}
						</div>
					))}
				</div>

				{/* Email Rows */}
				<div className="divide-y divide-gray-100">
					{filteredEmails.map((email, index) => {
						const initials = email.name
							.split(" ")
							.map((n) => n[0])
							.join("");
						const colors = colorMap[email.priority];

						return (
							<div
								key={index}
								className="flex justify-between items-baseline px-6 py-4 hover:bg-[#F9F9FC] transition-all"
							>
								<div className="flex items-center gap-3 min-w-0">
									<div
										className="w-1.5 h-6 rounded-full"
										style={{ backgroundColor: colors.bar }}
									></div>
									<div
										className="w-10 h-10 flex items-center justify-center rounded-full text-[14px] font-normal"
										style={{ backgroundColor: colors.bg, color: colors.text }}
									>
										{initials}
									</div>
									<div className="min-w-0">
										<p className="text-gray-900 truncate text-[15px]">
											{email.name}
										</p>
										<p className="text-gray-600 text-[14px] truncate">
											{email.subject}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-4 pr-2 min-w-[180px]">
									<button
										onClick={() => {
											setSelectedEmail(email);
											setShowEmailPopup(true);
										}}
										className="border border-[#A5A5A5] rounded-full px-5 py-[3px] text-[14px] font-normal hover:bg-gray-50"
									>
										View
									</button>

									<div className="flex items-center gap-[6px] text-gray-500 text-[13px]">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="15"
											height="15"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<circle cx="12" cy="12" r="10" />
											<polyline points="12 6 12 12 16 14" />
										</svg>
										<span>{email.time}</span>
									</div>
								</div>
							</div>
						);
					})}

					{filteredEmails.length === 0 && (
						<p className="text-center py-6 text-gray-400 text-[14px]">
							No emails found for this category.
						</p>
					)}
				</div>
			</div>
			{/* Email Popup */}
			{showEmailPopup && selectedEmail && (
				<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
					<div className="relative bg-[#FFFFFF] w-[80%] max-w-[800px] h-[70vh] rounded-[12px] shadow-lg flex flex-col overflow-hidden animate-fadeUp">
						{/* PopUp Header */}
						<div className="flex justify-between items-center p-5 border-b border-gray-200 bg-[#FAFAFA]">
							<div className="flex items-center gap-3">
								{/* User Avatar Placeholder with Initials */}
								<div
									className="w-10 h-10 flex items-center justify-center rounded-full text-[14px] font-medium"
									style={{
										backgroundColor:
											selectedEmail.priority === "high"
												? "#FDE7E7"
												: selectedEmail.priority === "medium"
												? "#FFF4DB"
												: "#E7F8EB",
										color:
											selectedEmail.priority === "high"
												? "#D94C4C"
												: selectedEmail.priority === "medium"
												? "#E5A100"
												: "#49A15A",
									}}
								>
									{selectedEmail.name
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</div>

								<div>
									<p className="text-gray-800 text-[15px] font-medium">
										{selectedEmail.name}
									</p>
									<p className="text-gray-600 text-[13px]">
										{selectedEmail.subject}
									</p>
								</div>

								<span
									className={`ml-3 text-[13px] px-3 py-[3px] rounded-full ${
										selectedEmail.priority === "high"
											? "bg-[#F16A6A] text-white"
											: selectedEmail.priority === "medium"
											? "bg-[#FABA2E] text-white"
											: "bg-[#95D6A4] text-white"
									}`}
								>
									{selectedEmail.priority.charAt(0).toUpperCase() +
										selectedEmail.priority.slice(1)}
								</span>
							</div>

							<div className="text-[13px] text-gray-500 flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="15"
									height="15"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 16 14" />
								</svg>
								<span>Oct 26, 2025, 2:11PM (2 days ago)</span>
							</div>
						</div>

						{/* Content */}
						<div className="flex-1 flex items-center justify-center text-gray-400 text-[18px]">
							Place for your email content
						</div>

						{/* Close Button */}
						<button
							onClick={() => setShowEmailPopup(false)}
							className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition"
						>
							✕
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
