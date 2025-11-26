/** @format */

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { fetchEmailList, type Email } from "@/utils/dashboardApi";
import { fetchEmailSummary } from "@/utils/dashboardApi";
import { getWeather } from "@/utils/weather";
import Sidebar from "@/components/Sidebar";

// Helper: Generate days for a given month
const generateCalendarDays = (year: number, month: number) => {
	const firstDay = new Date(year, month, 1).getDay();
	const totalDays = new Date(year, month + 1, 0).getDate();
	const days: (number | null)[] = [];
	for (let i = 0; i < firstDay; i++) days.push(null);
	for (let i = 1; i <= totalDays; i++) days.push(i);
	return days;
};

// Helper: Decode HTML entities
const decodeHtmlEntities = (text: string): string => {
	if (typeof document !== "undefined") {
		const textarea = document.createElement("textarea");
		textarea.innerHTML = text;
		return textarea.value;
	}
	// Fallback for server-side
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
		.replace(/&#x([a-f\d]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
};

// Helper: Sanitize email text
const sanitizeEmailText = (text: string | null | undefined): string => {
	if (!text) return "";
	const decoded = decodeHtmlEntities(text);
	// Remove HTML tags
	const withoutTags = decoded.replace(/<[^>]*>/g, "");
	// Remove control characters except newlines and tabs
	const cleaned = withoutTags.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
	// Normalize whitespace
	return cleaned.replace(/\s+/g, " ").trim();
};

// Helper: Get safe initials
const getSafeInitials = (name: string | null | undefined): string => {
	if (!name || typeof name !== "string") return "?";
	const cleaned = sanitizeEmailText(name);
	if (!cleaned) return "?";
	const parts = cleaned.split(" ").filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function EmailsPage() {
	const router = useRouter();

	const [activeTab, setActiveTab] = useState("All");
	const [showCalendar, setShowCalendar] = useState(false);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
	const [showEmailPopup, setShowEmailPopup] = useState(false);
	const [emails, setEmails] = useState<Email[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [summary, setSummary] = useState<string | null>(null);
	const [summaryLoading, setSummaryLoading] = useState(false);

	// Weather & location state
	const [location, setLocation] = useState<string>("New York");
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

	// Fetch emails on component mount
	useEffect(() => {
		const loadEmails = async () => {
			setIsLoading(true);
			try {
				const emailData = await fetchEmailList(50, 7); // Get last 50 emails from past 7 days
				setEmails(emailData.emails);
			} catch (error) {
				console.error("Failed to load emails:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadEmails();
	}, []);
	useEffect(() => {
		if (!selectedEmail?.id) {
			setSummary(null);
			return;
		}

		const getSummary = async () => {
			setSummaryLoading(true);
			try {
				const result = await fetchEmailSummary(selectedEmail.id);
				if (result?.status === "success") setSummary(result.summary);
				else setSummary(null);
			} catch (error) {
				console.error(error);
				setSummary(null);
			} finally {
				setSummaryLoading(false);
			}
		};

		getSummary();
	}, [selectedEmail]);

	// Fetch weather using Open-Meteo API directly
	const fetchWeatherForCoords = async (lat: number, lon: number) => {
		try {
			setIsWeatherLoading(true);
			console.log("Emails page: fetching weather for coords:", lat, lon);
			const data = await getWeather(lat, lon);
			const temp = data?.temperatureC;
			if (typeof temp === "number") setTemperatureC(temp);
		} catch (err) {
			console.error("Emails page: Error fetching weather:", err);
		} finally {
			setIsWeatherLoading(false);
		}
	};

	// Get coords either via geolocation or IP fallback, then fetch weather
	useEffect(() => {
		const ipFallback = async () => {
			try {
				const res = await fetch("https://ipapi.co/json/");
				if (!res.ok) return;
				const data = await res.json();
				const city =
					data.city || data.region || data.region_code || data.country_name;
				if (city) setLocation(city);
				if (data.latitude && data.longitude) {
					fetchWeatherForCoords(Number(data.latitude), Number(data.longitude));
				}
			} catch (e) {
				console.error("Emails page IP fallback error:", e);
			} finally {
				setIsLocationLoading(false);
			}
		};

		if (!("geolocation" in navigator)) {
			ipFallback();
			return;
		}

		const success = async (pos: GeolocationPosition) => {
			try {
				const { latitude: lat, longitude: lon } = pos.coords;

				// Use OpenStreetMap Nominatim reverse geocoding
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
				);
				if (!res.ok) {
					await ipFallback();
					return;
				}
				const data = await res.json();
				const city =
					data?.address?.city ||
					data?.address?.town ||
					data?.address?.village ||
					data?.address?.state ||
					data?.address?.county;
				if (city) setLocation(city);

				fetchWeatherForCoords(lat, lon).catch((e) => console.error(e));
			} catch (err) {
				console.error("Emails page reverse geocode error:", err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const failure = async (err: GeolocationPositionError) => {
			console.warn("Emails page geolocation failed:", err);
			await ipFallback();
		};

		navigator.geolocation.getCurrentPosition(success, failure, {
			timeout: 10000,
		});
	}, []);

	const colorMap = {
		high: { bar: "#8C2B4A", bg: "#FDE7E7", text: "#8C2B4A" },
		medium: { bar: "#AD819A", bg: "#FFF4DB", text: "#AD819A" },
		low: { bar: "#44548D", bg: "#E7F8EB", text: "#44548D" },
	};

	// Filter emails based on active tab
	let filteredEmails = emails;

	// Priority tabs
	if (["High", "Medium", "Low"].includes(activeTab)) {
		filteredEmails = emails.filter(
			(e) => e.priority === activeTab.toLowerCase()
		);
	}
	// Provider tabs
	else if (activeTab === "Gmail") {
		filteredEmails = emails.filter((e) => e.provider === "gmail");
	} else if (activeTab === "Outlook") {
		filteredEmails = emails.filter((e) => e.provider === "outlook");
	}
	// All tab shows everything

	const totalImportantCount = filteredEmails.length;

	// Count emails by provider
	const gmailCount = emails.filter((e) => e.provider === "gmail").length;
	const outlookCount = emails.filter((e) => e.provider === "outlook").length;

	const today = new Date();
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();
	const days = generateCalendarDays(year, month);

	const displayLocation = isLocationLoading
		? "Locating..."
		: location || "New York";
	const displayTemperature =
		temperatureC != null
			? `${Math.round(temperatureC)}°C`
			: isWeatherLoading
			? "Loading..."
			: "--";

	const handleDateClick = (day: number | null) => {
		if (!day) return;
		const newDate = new Date(year, month, day);
		setSelectedDate(newDate);
		setShowCalendar(false);
		console.log("Selected Date:", newDate.toDateString());
	};

	return (
		<div className="flex flex-col min-h-screen bg-[#F8F8FB] text-gray-800 p-3 sm:p-4 md:p-6 lg:p-8 relative pb-20 sm:pb-24 md:pb-8">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-2 sm:gap-3">
				<div className="flex flex-wrap items-center gap-2 sm:gap-3 text-gray-600 text-xs sm:text-sm">
					<span className="font-normal whitespace-nowrap">
						{today.toLocaleDateString("en-US", {
							weekday: "short",
							month: "short",
							day: "numeric",
						})}
					</span>

					<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 shadow-sm">
						<Image
							src="/Icons/Property 1=Location.svg"
							alt="Location"
							width={14}
							height={14}
							className="w-3 h-3 sm:w-[13px] sm:h-[13px] md:w-[14px] md:h-[14px] shrink-0"
						/>
						<span className="text-gray-700 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{displayLocation}</span>
					</span>

					<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 shadow-sm">
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Weather"
							width={14}
							height={14}
							className="w-3 h-3 sm:w-[13px] sm:h-[13px] md:w-[14px] md:h-[14px] shrink-0"
						/>
						<span className="text-gray-700 text-xs sm:text-sm">{displayTemperature}</span>
					</span>
				</div>

				<span className="text-gray-400 text-xs sm:text-sm font-normal whitespace-nowrap">
					{today.toLocaleTimeString("en-US", {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			</div>

			{/* Title */}
			<div className="mb-4 sm:mb-6 md:mb-8">
				<h1 className="text-xl sm:text-2xl md:text-[24px] lg:text-[26px] font-normal text-gray-900">Emails</h1>
				<p className="text-gray-600 mt-0.5 sm:mt-1 font-normal text-sm sm:text-base">
					Check your emails Mira is working on.
				</p>

				<button
					onClick={() => router.push("/dashboard")}
					className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-gray-800 text-xs sm:text-sm md:text-[15px] font-normal hover:opacity-70 transition"
				>
					<Image
						src="/Icons/Property 1=ChevronLeft.svg"
						alt="Back"
						width={18}
						height={18}
						className="opacity-90 w-4 h-4 sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px]"
					/>
					<span>Dashboard</span>
				</button>
			</div>

			{/* Emails Container */}
			<div className="bg-white border border-[#E7E7E7] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden relative">
				{/* Header Row */}
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 border-b border-[#E7E7E7] bg-[#F8F9FB]">
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto">
						<p className="text-sm sm:text-[15px] md:text-[16px] text-gray-800 font-normal">
							{isLoading
								? "Loading..."
								: `${totalImportantCount} ${
										totalImportantCount === 1 ? "Email" : "Emails"
								  }`}
						</p>
						{!isLoading && (
							<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
								<span className="text-[10px] sm:text-[11px] md:text-[13px] bg-[#8C2B4A] text-white px-2 sm:px-2.5 md:px-3 py-[2px] sm:py-[3px] rounded-full font-normal whitespace-nowrap">
									High: {emails.filter((e) => e.priority === "high").length}
								</span>
								<span className="text-[10px] sm:text-[11px] md:text-[13px] bg-[#AD819A] text-white px-2 sm:px-2.5 md:px-3 py-[2px] sm:py-[3px] rounded-full font-normal whitespace-nowrap">
									Medium: {emails.filter((e) => e.priority === "medium").length}
								</span>
								<span className="text-[10px] sm:text-[11px] md:text-[13px] bg-[#44548D] text-white px-2 sm:px-2.5 md:px-3 py-[2px] sm:py-[3px] rounded-full font-normal whitespace-nowrap">
									Low: {emails.filter((e) => e.priority === "low").length}
								</span>
							</div>
						)}
					</div>

					{/* Calendar */}
					<div
						className="relative flex items-center gap-1 text-gray-500 text-xs sm:text-[13px] md:text-[14px] cursor-pointer hover:text-[#62445E] shrink-0"
						onClick={() => setShowCalendar(!showCalendar)}
					>
						<Image
							src="/Icons/Property 1=Calendar.svg"
							alt="Calendar"
							width={16}
							height={16}
							className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4"
						/>
						<span className="whitespace-nowrap">
							{selectedDate.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>

						{/* Calendar Popup */}
						{showCalendar && (
							<>
								{/* Backdrop */}
								<div
									className="fixed inset-0 z-40"
									onClick={() => setShowCalendar(false)}
								/>
								<div
									className="absolute right-0 sm:right-0 top-8 sm:top-10 mt-2 flex flex-col items-start border border-[#E6E9F0] rounded-[8px] sm:rounded-[10px] bg-[#FFFFFF] p-3 sm:p-4 md:p-5 shadow-lg z-50"
									style={{ 
										width: "fit-content", 
										minWidth: "280px", 
										maxWidth: "calc(100vw - 2rem)",
										maxHeight: "calc(100vh - 8rem)",
										overflow: "auto"
									}}
									onClick={(e) => e.stopPropagation()}
								>
									{/* Month Header */}
									<div className="text-sm sm:text-[15px] md:text-[16px] font-medium text-[#000000] mb-2 sm:mb-3 md:mb-[8px] w-full text-center">
										{selectedDate.toLocaleDateString("en-US", {
											month: "long",
											year: "numeric",
										})}
									</div>

									{/* Weekdays Row */}
									<div className="grid grid-cols-7 w-full text-center text-xs sm:text-[13px] md:text-[14px] text-[#000000] mb-2 sm:mb-[4px] font-normal gap-0.5 sm:gap-1">
										{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, i) => (
											<div key={i} className="py-1 sm:py-[4px] font-medium">
												{day}
											</div>
										))}
									</div>

									{/* Dates Grid */}
									<div className="grid grid-cols-7 w-full text-center gap-1 sm:gap-[2px] md:gap-[4px] font-normal">
										{days.map((day, i) => {
											if (!day) {
												return (
													<div
														key={i}
														className="flex justify-center items-center text-xs sm:text-[13px] md:text-[14px] text-[#BFBFBF] min-h-[32px] sm:min-h-[36px] md:min-h-[40px]"
													>
														{" "}
													</div>
												);
											}

											const isSelected = day === selectedDate.getDate();

											return (
												<button
													key={i}
													type="button"
													onClick={() => handleDateClick(day)}
													className={`flex justify-center items-center text-xs sm:text-[13px] md:text-[14px] rounded-[6px] sm:rounded-[8px] min-h-[32px] sm:min-h-[36px] md:min-h-[40px] w-full cursor-pointer transition-all ${
														isSelected
															? "bg-[#444444] text-[#E5E5E5] font-medium"
															: "hover:bg-[#E6E6E6] text-[#000000]"
													}`}
												>
													{day}
												</button>
											);
										})}
									</div>
								</div>
							</>
						)}
					</div>
				</div>

				{/* Tabs */}
				<div className="flex border-b border-[#E7E7E7] text-xs sm:text-sm md:text-[15px] text-gray-500 overflow-x-auto scrollbar-hide">
					{/* All Tab */}
					<div
						onClick={() => setActiveTab("All")}
						className={`px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 md:py-4 cursor-pointer text-center transition-all whitespace-nowrap shrink-0 ${
							activeTab === "All"
								? "text-[#62445E] border-b-[2px] border-[#62445E] bg-white"
								: "hover:bg-[#F9F9FC]"
						}`}
					>
						All
					</div>

					{/* Gmail Tab (only show if there are Gmail emails) */}
					{gmailCount > 0 && (
						<div
							onClick={() => setActiveTab("Gmail")}
							className={`px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 md:py-4 cursor-pointer text-center transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 shrink-0 ${
								activeTab === "Gmail"
									? "text-[#62445E] border-b-[2px] border-[#62445E] bg-white"
									: "hover:bg-[#F9F9FC]"
							}`}
						>
							<Image
								src="/Icons/Email/skill-icons_gmail-light.png"
								alt="Gmail"
								width={18}
								height={18}
								className="opacity-90 w-4 h-4 sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px]"
							/>
							<span className="hidden sm:inline">Gmail </span>({gmailCount})
						</div>
					)}

					{/* Outlook Tab (only show if there are Outlook emails) */}
					{outlookCount > 0 && (
						<div
							onClick={() => setActiveTab("Outlook")}
							className={`px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 md:py-4 cursor-pointer text-center transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 shrink-0 ${
								activeTab === "Outlook"
									? "text-[#62445E] border-b-[2px] border-[#62445E] bg-white"
									: "hover:bg-[#F9F9FC]"
							}`}
						>
							<Image
								src="/Icons/Email/vscode-icons_file-type-outlook.png"
								alt="Outlook"
								width={18}
								height={18}
								className="opacity-90 w-4 h-4 sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px]"
							/>
							<span className="hidden sm:inline">Outlook </span>({outlookCount})
						</div>
					)}

					{/* Priority Tabs */}
					{["High", "Medium", "Low"].map((tab, i) => (
						<div
							key={i}
							onClick={() => setActiveTab(tab)}
							className={`px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 md:py-4 cursor-pointer text-center transition-all whitespace-nowrap shrink-0 ${
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
				<div>
					{isLoading ? (
						<div className="text-center py-8 sm:py-10 md:py-12 text-gray-500">
							<div className="animate-pulse">
								<p className="text-sm sm:text-[15px] md:text-[16px]">Loading emails...</p>
							</div>
						</div>
					) : filteredEmails.length === 0 ? (
						<p className="text-center py-4 sm:py-5 md:py-6 text-gray-400 text-xs sm:text-[13px] md:text-[14px] px-2">
							{emails.length === 0
								? "No emails found. Connect your Gmail to see emails."
								: "No emails found for this category."}
						</p>
					) : (
						filteredEmails.map((email, index) => {
							// Skip invalid emails
							if (!email || (!email.sender_name && !email.sender_email)) {
								return null;
							}

							const senderName = sanitizeEmailText(email.sender_name) || sanitizeEmailText(email.sender_email) || "Unknown Sender";
							const subject = sanitizeEmailText(email.subject) || "No subject";
							const initials = getSafeInitials(email.sender_name || email.sender_email);
							const colors = colorMap[email.priority] || colorMap.low;

							return (
								<div
									key={email.id || index}
									onClick={() => {
										setSelectedEmail(email);
										setShowEmailPopup(true);
									}}
									className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 hover:bg-[#F9F9FC] transition-all cursor-pointer border-b border-gray-100 last:border-b-0"
								>
									<div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 w-full sm:w-auto">
										<div
											className="w-1 sm:w-1.5 h-5 sm:h-6 rounded-full shrink-0"
											style={{ backgroundColor: colors.bar }}
										></div>
										<div
											className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full text-xs sm:text-[13px] md:text-[14px] font-normal shrink-0"
											style={{ backgroundColor: colors.bg, color: colors.text }}
										>
											{initials}
										</div>
										<div className="min-w-0 flex-1">
											<p className="text-gray-900 truncate text-xs sm:text-sm md:text-[15px] flex items-center gap-1.5 sm:gap-2 flex-wrap">
												<span className="truncate">{senderName}</span>
												{email.is_unread && (
													<span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full shrink-0"></span>
												)}
												{/* Show provider badge only in "All" tab */}
												{activeTab === "All" && email.provider && (
													<span
														className={`text-[9px] sm:text-[10px] md:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${
															email.provider === "gmail"
																? "bg-blue-100 text-blue-700"
																: "bg-purple-100 text-purple-700"
														}`}
													>
														{email.provider === "gmail" ? "Gmail" : "Outlook"}
													</span>
												)}
											</p>
											<p className="text-gray-600 text-xs sm:text-[13px] md:text-[14px] truncate mt-0.5 sm:mt-1">
												{subject}
											</p>
										</div>
									</div>

									<div className="flex items-center gap-2 sm:gap-3 md:gap-4 pr-0 sm:pr-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
										<button
											onClick={(e) => {
												e.stopPropagation(); // Prevent opening email popup when clicking view button
												setSelectedEmail(email);
												setShowEmailPopup(true);
											}}
											className="border border-[#A5A5A5] rounded-full px-3 sm:px-4 md:px-5 py-[2px] sm:py-[3px] text-xs sm:text-[13px] md:text-[14px] font-normal hover:bg-gray-50 whitespace-nowrap"
										>
											View
										</button>

										<div className="flex items-center gap-1 sm:gap-[6px] text-gray-500 text-[10px] sm:text-[12px] md:text-[13px]">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="1.8"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="sm:w-[13px] sm:h-[13px] md:w-[15px] md:h-[15px]"
											>
												<circle cx="12" cy="12" r="10" />
												<polyline points="12 6 12 12 16 14" />
											</svg>
											<span className="whitespace-nowrap">{email.time_ago || ""}</span>
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
			{/* Email Popup */}
			{showEmailPopup && selectedEmail && (
				<div
					className="fixed inset-0 
        bg-black/55
        backdrop-blur-[2px]
        flex items-center justify-center
        z-50 transition-all p-3 sm:p-4"
				>
					<div
						className="relative bg-white 
    w-full sm:w-[90%] md:w-[85%] max-w-[850px] 
    max-h-[85vh] sm:max-h-[80vh]
    rounded-lg sm:rounded-xl
    shadow-[0_8px_40px_rgba(0,0,0,0.10)]
    overflow-y-auto 
    p-0 
    animate-fadeUp"
					>
						{/* PopUp Header */}
						<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 border-b border-gray-200 bg-[#FAFAFA]">
							<div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
								{/* User Avatar Placeholder with Initials */}
								<div
									className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full text-xs sm:text-[13px] md:text-[14px] font-medium shrink-0"
									style={{
										backgroundColor:
											selectedEmail.priority === "high"
												? "#FDE7E7"
												: selectedEmail.priority === "medium"
												? "#FFF4DB"
												: "#E7F8EB",
										color:
											selectedEmail.priority === "high"
												? "#8C2B4A"
												: selectedEmail.priority === "medium"
												? "#AD819A"
												: "#44548D",
									}}
								>
									{getSafeInitials(selectedEmail.sender_name || selectedEmail.sender_email)}
								</div>

								<div className="flex-1 min-w-0">
									<p className="text-gray-800 text-sm sm:text-[14px] md:text-[15px] font-medium truncate">
										{sanitizeEmailText(selectedEmail.sender_name) || sanitizeEmailText(selectedEmail.sender_email) || "Unknown Sender"}
									</p>
									<p className="text-gray-600 text-xs sm:text-[12px] md:text-[13px] truncate">
										{sanitizeEmailText(selectedEmail.sender_email) || ""}
									</p>
								</div>

								<span
									className={`ml-0 sm:ml-3 text-[10px] sm:text-[11px] md:text-[13px] px-2 sm:px-2.5 md:px-3 py-[2px] sm:py-[3px] rounded-full whitespace-nowrap shrink-0 ${
										selectedEmail.priority === "high"
											? "bg-[#8C2B4A] text-white"
											: selectedEmail.priority === "medium"
											? "bg-[#AD819A] text-white"
											: "bg-[#44548D] text-white"
									}`}
								>
									{selectedEmail.priority.charAt(0).toUpperCase() +
										selectedEmail.priority.slice(1)}
								</span>
							</div>

							<div className="text-[10px] sm:text-[11px] md:text-[13px] text-gray-500 flex items-center gap-1.5 sm:gap-2 ml-0 sm:ml-4 w-full sm:w-auto">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="sm:w-[13px] sm:h-[13px] md:w-[15px] md:h-[15px]"
								>
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 16 14" />
								</svg>
								<span className="break-words">
									{new Date(selectedEmail.timestamp).toLocaleString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric",
										hour: "numeric",
										minute: "2-digit",
										hour12: true,
									})}{" "}
									({selectedEmail.time_ago})
								</span>
							</div>
						</div>

						{/* Email Subject */}
						<div className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 border-b border-gray-100 bg-[#FAFAFA]">
							<p className="text-gray-900 text-sm sm:text-[15px] md:text-[16px] font-semibold break-words">
								{sanitizeEmailText(selectedEmail.subject) || "No subject"}
							</p>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
							{summaryLoading ? (
								<div className="text-center text-gray-400 text-sm sm:text-[15px] md:text-[16px] py-8 sm:py-10 md:py-12">
									Loading summary...
								</div>
							) : summary ? (
								<div
									className="text-gray-700 text-xs sm:text-[13px] md:text-[14px] leading-relaxed whitespace-pre-wrap break-words"
									dangerouslySetInnerHTML={{
										__html: summary.replace(/\n/g, "<br />"),
									}}
								/>
							) : (
								<div className="text-center text-gray-400 text-sm sm:text-[15px] md:text-[16px] py-8 sm:py-10 md:py-12">
									No content available
								</div>
							)}
						</div>

						{/* Close Button */}
						<button
							onClick={() => setShowEmailPopup(false)}
							className="absolute top-2 sm:top-3 md:top-4 right-2 sm:right-3 md:right-4 text-gray-400 hover:text-gray-700 transition text-lg sm:text-xl md:text-[24px] w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
						>
							✕
						</button>
					</div>
				</div>
			)}
			<Sidebar />
		</div>
	);
}
