/** @format */
// @ts-nocheck

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { fetchEmailList, type Email } from "@/utils/dashboardApi";

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
	const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
	const [showEmailPopup, setShowEmailPopup] = useState(false);
	const [emails, setEmails] = useState<Email[]>([]);
	const [isLoading, setIsLoading] = useState(true);

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

	// Helper: map Open-Meteo weathercode to simple description
	const openMeteoCodeToDesc = (code: number) => {
		switch (code) {
			case 0:
				return 'Clear';
			case 1:
			case 2:
			case 3:
				return 'Partly cloudy';
			case 45:
			case 48:
				return 'Fog';
			case 51:
			case 53:
			case 55:
				return 'Drizzle';
			case 61:
			case 63:
			case 65:
				return 'Rain';
			case 71:
			case 73:
			case 75:
				return 'Snow';
			case 80:
			case 81:
			case 82:
				return 'Showers';
			case 95:
			case 96:
			case 99:
				return 'Thunderstorm';
			default:
				return 'Unknown';
		}
	};

	// Fetch weather from the same-origin API route (/api/weather) using coords
	const fetchWeatherForCoords = async (lat: number, lon: number) => {
		try {
			setIsWeatherLoading(true);
			const url = `/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
			const resp = await fetch(url);
			if (!resp.ok) {
				let details = '';
				try { details = await resp.text(); } catch { details = '<unreadable response body>'; }
				throw new Error(`Weather proxy failed: ${resp.status} ${details}`);
			}
			const data: any = await resp.json();
			const temp = data?.temperatureC ?? data?.temperature ?? data?.tempC ?? null;
			if (typeof temp === 'number') setTemperatureC(temp);
		} catch (err) {
			console.error('Emails page: Error fetching weather:', err);
		} finally {
			setIsWeatherLoading(false);
		}
	};

	// Get coords either via geolocation or IP fallback, then fetch weather
	useEffect(() => {
		const ipFallback = async () => {
			try {
				const res = await fetch('https://ipapi.co/json/');
				if (!res.ok) return;
				const data = await res.json();
				const city = data.city || data.region || data.region_code || data.country_name;
				if (city) setLocation(city);
				if (data.latitude && data.longitude) {
					fetchWeatherForCoords(Number(data.latitude), Number(data.longitude));
				}
			} catch (e) {
				console.error('Emails page IP fallback error:', e);
			} finally {
				setIsLocationLoading(false);
			}
		};

		if (!('geolocation' in navigator)) {
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
				console.error('Emails page reverse geocode error:', err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const failure = async (err: any) => {
			console.warn('Emails page geolocation failed:', err);
			await ipFallback();
		};

		navigator.geolocation.getCurrentPosition(success, failure, { timeout: 10000 });
	}, []);

	const colorMap = {
		high: { bar: "#F16A6A", bg: "#FDE7E7", text: "#D94C4C" },
		medium: { bar: "#FABA2E", bg: "#FFF4DB", text: "#E5A100" },
		low: { bar: "#95D6A4", bg: "#E7F8EB", text: "#49A15A" },
	};

	const filteredEmails =
		activeTab === "All"
			? emails
			: emails.filter((e) => e.priority === activeTab.toLowerCase());
	
	const totalImportantCount = filteredEmails.length;

	const today = new Date();
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();
	const days = generateCalendarDays(year, month);

	const displayLocation = isLocationLoading ? "Locating..." : location || "New York";
	const displayTemperature =
		temperatureC != null
			? `${Math.round(temperatureC)}°C`
			: isWeatherLoading
			? "Loading..."
			: "--";

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
						<span className="text-gray-700">{displayLocation}</span>
					</span>

					<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
						<Image
							src="/Icons/Property 1=Sun.svg"
							alt="Weather"
							width={14}
							height={14}
						/>
						<span className="text-gray-700">{displayTemperature}</span>
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
							{isLoading ? "Loading..." : `${totalImportantCount} ${totalImportantCount === 1 ? "Email" : "Emails"}`}
						</p>
						{!isLoading && (
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
						)}
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
					{isLoading ? (
						<div className="text-center py-12 text-gray-500">
							<div className="animate-pulse">
								<p className="text-[16px]">Loading emails...</p>
							</div>
						</div>
					) : filteredEmails.length === 0 ? (
						<p className="text-center py-6 text-gray-400 text-[14px]">
							{emails.length === 0 ? "No emails found. Connect your Gmail to see emails." : "No emails found for this category."}
						</p>
					) : (
						filteredEmails.map((email, index) => {
							const initials = email.sender_name
								.split(" ")
								.map((n) => n[0])
								.join("");
							const colors = colorMap[email.priority];

							return (
								<div
									key={email.id || index}
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
										<div className="min-w-0 flex-1">
											<p className="text-gray-900 truncate text-[15px] flex items-center gap-2">
												{email.sender_name}
												{email.is_unread && (
													<span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
												)}
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
											<span>{email.time_ago}</span>
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
									{selectedEmail.sender_name
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</div>

								<div className="flex-1 min-w-0">
									<p className="text-gray-800 text-[15px] font-medium truncate">
										{selectedEmail.sender_name}
									</p>
									<p className="text-gray-600 text-[13px] truncate">
										{selectedEmail.sender_email}
									</p>
								</div>

								<span
									className={`ml-3 text-[13px] px-3 py-[3px] rounded-full whitespace-nowrap ${
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

							<div className="text-[13px] text-gray-500 flex items-center gap-2 ml-4">
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
								<span>
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
						<div className="px-5 py-3 border-b border-gray-100 bg-[#FAFAFA]">
							<p className="text-gray-900 text-[16px] font-semibold">
								{selectedEmail.subject}
							</p>
						</div>

						{/* Content */}
						<div className="flex-1 overflow-y-auto p-5">
							{selectedEmail.body ? (
								<div
									className="text-gray-700 text-[14px] leading-relaxed whitespace-pre-wrap"
									dangerouslySetInnerHTML={{
										__html: selectedEmail.body.replace(/\n/g, "<br />"),
									}}
								/>
							) : (
								<div className="text-center text-gray-400 text-[16px] py-12">
									No content available
								</div>
							)}
						</div>

						{/* Close Button */}
						<button
							onClick={() => setShowEmailPopup(false)}
							className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-[24px] w-8 h-8 flex items-center justify-center"
						>
							✕
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
