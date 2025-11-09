/** @format */
"use client";

import Image from "next/image";
import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";

import { useState, useEffect } from "react";
import {
	extractTokenFromUrl,
	storeAuthToken,
	isAuthenticated,
	clearAuthTokens,
} from "@/utils/auth";

function MobileProfileMenu() {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	// Close when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".mobile-profile-menu")) setOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleLogout = () => {
		console.log("Logout initiated from Dashboard");
		clearAuthTokens();

		// Dispatch event to notify other components
		window.dispatchEvent(new CustomEvent("userDataUpdated"));

		console.log("User logged out from Dashboard, redirecting to login...");
		router.push("/login");
	};

	// Note: Greeting is now handled by the backend API in the sendSystemTime function
	// This hardcoded greeting has been removed to prevent conflicts

	return (
		<div className="relative mobile-profile-menu flex flex-col items-center">
			{/* Profile Icon */}
			<button
				onClick={() => setOpen(!open)}
				className={`flex items-center justify-center w-11 h-11 rounded-lg border border-gray-100 shadow-sm bg-white transition-all ${
					open ? "bg-gray-100" : "hover:shadow-md"
				}`}
			>
				<Icon name="Profile" size={22} />
			</button>
			{/* Popup */}
			{open && (
				<div
					className="absolute bottom-[70px] right-[-60px] w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 animate-fadeIn z-50"
					style={{ transform: "translateX(-20%)" }}
				>
					<div className="px-4 pb-2 border-b border-gray-200">
						<div className="flex flex-col gap-0.5 text-gray-700 text-sm">
							<div className="flex items-center gap-2">
								<Image
									src="/Icons/Property 1=Profile.svg"
									alt="User"
									width={16}
									height={16}
									className="w-4 h-4 opacity-80"
								/>
								<span>miraisthbest@gmail.com</span>
							</div>
							<span className="pl-6 text-gray-500 text-xs">User Name</span>
						</div>
					</div>

					<button
						onClick={() => alert("Switch account coming soon!")}
						className="flex items-center gap-3 w-full px-4 py-2 text-sm rounded-md hover:bg-[#f7f4fb] transition text-gray-700"
					>
						<Icon name="SwitchAccount" size={18} />
						Switch account
					</button>

					<hr className="my-1 border-gray-200" />

					<button
						onClick={handleLogout}
						className="flex items-center gap-3 w-full px-4 py-2 text-sm text-grey-600 hover:bg-grey-50 rounded-md transition"
					>
						<Icon name="Logout" size={18} />
						Log out
					</button>
				</div>
			)}
		</div>
	);
}
export default function Dashboard() {
	const router = useRouter();
	const [currentTime, setCurrentTime] = useState(new Date());
	const [serverGreeting] = useState<string | null>(null);

	const [firstName, setFirstName] = useState<string | null>(null);
	const [, setGreeting] = useState<string>("");

	// Weather & location state for dashboard header
	const [location, setLocation] = useState<string>("New York");
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	const [weatherDescription, setWeatherDescription] = useState<string | null>(null);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

	// Check authentication on mount and refresh token if needed
	useEffect(() => {
		const checkAuth = async () => {
			// Try to refresh token if expired (for returning users)
			const { getValidToken } = await import("@/utils/auth");
			const validToken = await getValidToken();
			
			if (!validToken) {
				// No valid token, redirect to login
				router.push("/login");
				return;
			}
		};
		checkAuth();
	}, [router]);

	// Update time every second
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	const displayLocation = isLocationLoading ? "Locating..." : location || "New York";
	const displayTemperature =
		temperatureC != null
			? `${Math.round(temperatureC)}°C`
			: isWeatherLoading
			? "Loading..."
			: "--";
	const displayWeatherDescription =
		weatherDescription ?? (isWeatherLoading ? "Loading..." : "Weather unavailable");

	// Handle OAuth callback token extraction (no greeting call to prevent double voice)
	useEffect(() => {
		const urlToken = extractTokenFromUrl();
		if (urlToken) {
			storeAuthToken(urlToken);
			// Clear the URL hash after extracting the token
			window.history.replaceState({}, document.title, window.location.pathname);
			// Reload the page to refresh user data in all components
			window.location.reload();
			return;
		}
	}, []);

	// Format time as needed
	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	};

	// Get greeting based on time
	const getGreeting = () => {
		const hour = currentTime.getHours();
		if (hour < 12) return "Good Morning";
		if (hour < 18) return "Good Afternoon";
		return "Good Evening";
	};

	// 🟣 Load user name from localStorage and personalize greeting
	useEffect(() => {
		const updateGreeting = () => {
			const storedName =
				localStorage.getItem("mira_username") ||
				localStorage.getItem("mira_full_name") ||
				localStorage.getItem("user_name") ||
				"there";

			const hour = new Date().getHours();
			let timeGreeting = "Good Evening";
			if (hour < 12) timeGreeting = "Good Morning";
			else if (hour < 18) timeGreeting = "Good Afternoon";

			const first = storedName.split(" ")[0]; // only first name
			setFirstName(first);
			setGreeting(`${timeGreeting}, ${first}!`);
		};

		// Update greeting initially
		updateGreeting();

		// Listen for user data updates to refresh greeting
		const handleUserDataUpdate = () => {
			updateGreeting();
		};

		window.addEventListener("userDataUpdated", handleUserDataUpdate);

		return () => {
			window.removeEventListener("userDataUpdated", handleUserDataUpdate);
		};
	}, []);

	// Helper: map Open-Meteo weathercode to simple description
	const openMeteoCodeToDesc = (code: number) => {
		// Simplified mapping for common values
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
			console.log('Dashboard: fetching weather from internal proxy:', url);
			const resp = await fetch(url);
			if (!resp.ok) {
				let details = '';
				try { details = await resp.text(); } catch { details = '<unreadable response body>'; }
				throw new Error(`Weather proxy failed: ${resp.status} ${details}`);
			}
			const data: any = await resp.json();
			const temp = data?.temperatureC ?? data?.temperature ?? data?.tempC ?? null;
			let desc: string | null = null;
			// Prefer description from normalized field
			if (data?.description) desc = data.description;
			// If provider returned raw Open-Meteo payload, map its weathercode
			else if (data?.raw?.current_weather?.weathercode !== undefined) {
				desc = openMeteoCodeToDesc(Number(data.raw.current_weather.weathercode));
			}
			// If provider is weatherapi.com style
			else if (data?.raw?.current?.condition?.text) {
				desc = data.raw.current.condition.text;
			}
			if (typeof temp === 'number') setTemperatureC(temp);
			if (desc) setWeatherDescription(desc);
			if (!desc && temp == null) console.warn('Dashboard: weather response had no usable fields', data);
		} catch (err) {
			console.error('Dashboard: Error fetching weather from internal API (/api/weather):', err);
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
				if (data.timezone) {/* timezone not used here */}
				if (city) setLocation(city);
				if (data.latitude && data.longitude) {
					setLatitude(Number(data.latitude));
					setLongitude(Number(data.longitude));
					fetchWeatherForCoords(Number(data.latitude), Number(data.longitude));
				}
			} catch (e) { console.error('Dashboard IP fallback error:', e); }
			finally { setIsLocationLoading(false); }
		};

		if (!('geolocation' in navigator)) { ipFallback(); return; }

		const success = async (pos: GeolocationPosition) => {
			try {
				const { latitude: lat, longitude: lon } = pos.coords;
				setLatitude(lat); setLongitude(lon);
				
				// Use OpenStreetMap Nominatim reverse geocoding (no key required)
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
				);
				if (!res.ok) {
					// If reverse geocoding fails, fall back to IP-based lookup
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
				console.error('Dashboard reverse geocode error:', err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const failure = async (err: any) => { console.warn('Dashboard geolocation failed:', err); await ipFallback(); };

		navigator.geolocation.getCurrentPosition(success, failure, { timeout: 10000 });
	}, []);
	return (
		<div className="flex flex-col md:flex-row h-screen bg-[#F8F8FB] text-gray-800">
			{/* Main Content */}
			<main className="flex-1 px-4 sm:px-8 md:px-12 py-8 md:py-10 overflow-y-auto">
				{/* Header Section - Styled like Figma */}
				<div className="mb-10 md:mb-12 text-center md:text-left space-y-3">
					{/* Top Line: Date | Location | Weather */}
					<div className="flex flex-wrap items-center gap-3 text-gray-600 text-sm">
						<span className="font-medium">
							{new Date().toLocaleDateString("en-US", {
								weekday: "short",
								month: "short",
								day: "numeric",
							})}
						</span>

						{/* Location chip */}
						<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
							<Image
								src="/Icons/Property 1=Location.svg"
								alt="Location"
								width={14}
								height={14}
							/>
							<span className="text-gray-700">{displayLocation}</span>
						</span>

						{/* Weather chip */}
						<span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
							<Image
								src="/Icons/Property 1=Sun.svg"
								alt="Weather"
								width={14}
								height={14}
							/>
							<span className="text-gray-700">{displayTemperature}</span>
						</span>

						{/* Time (right-aligned on large screens) */}
						<span className="ml-auto text-gray-400 text-sm font-medium">
							{formatTime(currentTime)}
						</span>
					</div>

					{/* Greeting */}
					<div className="mt-8 md:mt-10">
						<h1 className="text-3xl md:text-[30px] font-normal text-black leading-snug">
							{serverGreeting ?? `${getGreeting()}, ${firstName ?? "there"}!`}
						</h1>
						<p className="text-gray-600 text-base mt-2">
							You’re feeling good today. Here’s your day at a glance.
						</p>
					</div>
				</div>

				{/* Daily Overview Section */}
				<section className="mt-6 mb-8">
					<div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] px-8 py-5 md:py-6 flex flex-col md:flex-row md:justify-between md:items-center gap-6">
						{/* Left content block */}
						<div className="flex flex-col gap-4">
							{/* Title */}
							<h3 className="text-[20px] md:text-[21px] font-normal text-gray-800">
								Daily Overview
							</h3>

							{/* Overview items */}
							<div className="flex flex-col sm:flex-row flex-wrap items-start md:items-center gap-8 text-[15px] md:text-[15.5px] font-normal text-gray-800">
								{/* Weather */}
								<div className="flex items-center gap-3">
									<div className="border border-gray-300 rounded-full p-[6px] flex items-center justify-center">
										<Image
											src="/Icons/Property 1=Sun.svg"
											alt="Weather"
											width={22}
											height={22}
										/>
									</div>
									<div>
										<p className="text-[15px] leading-tight">
											{displayWeatherDescription}
										</p>
										<p className="text-gray-500 text-[13.5px]">
											{displayTemperature}
										</p>
									</div>
								</div>

								{/* Commute */}
								<div className="flex items-center gap-3">
									<div className="border border-gray-300 rounded-full p-[6px] flex items-center justify-center">
										<Image
											src="/Icons/Property 1=Car.svg"
											alt="Commute"
											width={22}
											height={22}
										/>
									</div>
									<div>
										<p className="text-[15px] leading-tight">25 min commute</p>
										<p className="text-gray-500 text-[13.5px]">the office</p>
									</div>
								</div>

								{/* Meeting */}
								<div className="flex items-center gap-3">
									<div className="border border-gray-300 rounded-full p-[6px] flex items-center justify-center">
										<Image
											src="/Icons/Property 1=Calendar.svg"
											alt="Meeting"
											width={22}
											height={22}
										/>
									</div>
									<div>
										<p className="text-[15px] leading-tight">Team Standup</p>
										<p className="text-gray-500 text-[13.5px]">
											9:00 AM | 15min
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Button (right side) */}
						<button
							onClick={() => router.push("/scenarios/morning-brief")}
							className="self-center md:self-auto px-6 py-[6px] border border-gray-400 rounded-full hover:bg-gray-50 transition text-[14.5px] font-normal text-gray-800"
						>
							View Full Brief
						</button>
					</div>
				</section>

				{/* Dashboard Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{/* Emails */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200">
						<div>
							{/* Header */}
							<h3 className="text-[18px] font-medium mb-3 flex items-center gap-2 text-gray-900">
								<Image
									src="/Icons/Property 1=Email.svg"
									alt="Email"
									width={20}
									height={20}
									className="opacity-90"
								/>
								Emails
							</h3>

							{/* Important Emails */}
							<p className="text-[17px] text-gray-900 mb-0.5 leading-tight">
								<span className="font-semibold text-[19px]">12</span> Important
								Emails
							</p>

							{/* Clock icon line */}
							<div className="flex items-center gap-1.5 text-[14.5px] text-gray-500 mb-4">
								<Image
									src="/Icons/Property 1=Clock.svg"
									alt="Time"
									width={16}
									height={16}
									className="opacity-80"
								/>
								from the last 24 hours
							</div>

							{/* Priority Distribution */}
							<p className="text-[16.5px] text-gray-800 mb-2 font-normal">
								Priority Distribution
							</p>
							<div className="flex flex-wrap gap-2 mb-3">
								{/* High */}
								<span
									className="text-white text-[13.5px] px-[8px] py-[2px] rounded-full font-normal"
									style={{ background: "#F16A6A", borderRadius: "99px" }}
								>
									High: 3
								</span>

								{/* Medium */}
								<span
									className="text-white text-[13.5px] px-[8px] py-[2px] rounded-full font-normal"
									style={{ background: "#FABA2E", borderRadius: "99px" }}
								>
									Medium: 5
								</span>

								{/* Low */}
								<span
									className="text-white text-[13.5px] px-[8px] py-[2px] rounded-full font-normal"
									style={{ background: "#95D6A4", borderRadius: "99px" }}
								>
									Low: 4
								</span>
							</div>

							{/* Divider */}
							<hr className="border-gray-200 mb-2" />

							{/* Unread / Trend */}
							<div className="flex justify-between items-center text-[15px] text-gray-700 mb-2">
								<div className="flex flex-col leading-[1.1]">
									<p className="font-normal mb-[2px]">Unread</p>
									<span className="text-gray-900 font-semibold text-[17px]">
										8
									</span>
								</div>

								<div className="flex flex-col items-end leading-[1.1]">
									<p className="font-normal mb-[2px]">Trend</p>
									<div className="flex items-center gap-[3px]">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="#1E1E1E"
											strokeWidth="1.8"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="opacity-90"
										>
											<path d="M3 7L10 14L14 10L21 17" />
											<path d="M21 12V17H16" />
										</svg>
										<span className="text-gray-900 font-semibold text-[17px]">
											15%
										</span>
									</div>
								</div>
							</div>

							{/* Divider */}
							<hr className="border-gray-200 mb-2" />

							{/* Top Sender Box */}
							<div className="bg-[#F8F9FB] border border-gray-200 rounded-xl px-3.5 py-2.5 text-[15px]">
								<p className="text-gray-600 font-normal leading-tight">
									Top Sender
								</p>
								<p className="text-gray-900 font-medium leading-tight mt-[2px]">
									John Mayer
								</p>
							</div>
						</div>

						{/* View All Button */}
						<button
							onClick={() => router.push("/dashboard/emails")}
							className="mt-5 w-full rounded-full text-[15px] font-medium text-[#1E1E1E] tracking-[0.01em] transition-all duration-150 hover:bg-[#F8F8F8] active:scale-[0.99]"
							style={{
								border: "1px solid #1E1E1E",
								padding: "4px 0",
								lineHeight: "1.1",
							}}
						>
							View All
						</button>
					</div>

					{/* Events */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200">
						<div>
							{/* Header */}
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-[18px] font-semibold flex items-center gap-2 text-gray-900">
									<Image
										src="/Icons/Property 1=Calendar.svg"
										alt="Calendar"
										width={20}
										height={20}
										className="opacity-90"
									/>
									Events
								</h3>

								{/* RSVP Badge */}
								<span className="text-[13px] px-[10px] py-[3px] bg-gray-50 border border-gray-300 rounded-full text-gray-700 font-medium">
									3 RSVPs
								</span>
							</div>

							{/* Busy Day */}
							<div
								className="px-[12px] py-[8px] mb-4"
								style={{
									background: "#FDF0EF",
									border: "0.5px solid #C4C7CC",
									borderRadius: "8px",
								}}
							>
								<div className="flex items-center gap-[6px] mb-[2px]">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#F16A6A"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="translate-y-[0.5px]"
									>
										<circle cx="12" cy="12" r="10" />
										<polyline points="12 6 12 12 16 14" />
									</svg>
									<span className="text-[15px] font-semibold text-[#000000]">
										Busy Day
									</span>
								</div>
								<p className="text-[14px] text-[#000000] leading-[1.2] ml-[22px]">
									6.5h across 4 events
								</p>
							</div>

							{/* Next Event Section */}
							<p className="text-[15px] text-gray-800 font-semibold mb-2">
								Next Event
							</p>
							<div className="bg-[#F8F9FB] border border-gray-200 rounded-xl px-4 py-3 mb-4">
								<p className="text-[16px] font-semibold text-gray-900 mb-2">
									Team Standup
								</p>

								{/* Time */}
								<div className="flex items-center gap-2 text-[14px] text-gray-600 mb-1">
									<Image
										src="/Icons/Property 1=Clock.svg"
										alt="Time"
										width={14}
										height={14}
									/>
									9:00 AM | 15min
								</div>

								{/* Zoom */}
								<div className="flex items-center gap-2 text-[14px] text-gray-600 mb-1">
									<Image
										src="/Icons/qlementine-icons_camera-16.svg"
										alt="Zoom"
										width={14}
										height={14}
									/>
									Zoom
								</div>

								{/* Members */}
								<div className="flex items-center gap-2 text-[14px] text-gray-600">
									<Image
										src="/Icons/mingcute_group-line.svg"
										alt="Members"
										width={14}
										height={14}
									/>
									Members here
								</div>
							</div>

							{/* Tags */}
							<div className="flex flex-wrap gap-2 mb-1">
								<span
									className="text-white text-[13px] px-[10px] py-[4px] rounded-full font-normal"
									style={{
										background: "#95D6A4",
										borderRadius: "99px",
									}}
								>
									2 deep work blocks
								</span>

								<span
									className="text-white text-[13px] px-[10px] py-[4px] rounded-full font-normal"
									style={{
										background: "#F16A6A",
										borderRadius: "99px",
									}}
								>
									1 at risk task
								</span>
							</div>
						</div>

						{/* View All Button */}
						<button
							className="mt-5 w-full rounded-full text-[15px] font-medium text-[#1E1E1E] tracking-[0.01em] transition-all duration-150 hover:bg-[#F8F8F8] active:scale-[0.99]"
							style={{
								border: "1px solid #1E1E1E",
								padding: "4px 0",
								lineHeight: "1.1",
							}}
						>
							View All
						</button>
					</div>

					{/* Tasks */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200">
						<div>
							{/* Header */}
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-[17px] md:text-[18px] font-semibold flex items-center gap-2 text-gray-900">
									<Image
										src="/Icons/Property 1=Brief.svg"
										alt="Tasks"
										width={20}
										height={20}
										className="opacity-90"
									/>
									Tasks
								</h3>

								{/* Task Count Badge */}
								<span className="text-[13px] bg-[#F7D76C] text-[#000000] font-semibold px-[9px] py-[3px] rounded-full shadow-sm">
									8
								</span>
							</div>

							{/* Task List */}
							{[
								{ name: "Finalize dashboard layout", time: "Today, 11:00 AM" },
								{ name: "Review daily brief copy", time: "Today, 1:30 PM" },
								{ name: "Sync calendar API", time: "Today, 3:00 PM" },
							].map((task, i) => (
								<div
									key={i}
									className="bg-[#F8F9FB] border border-gray-200 rounded-xl px-4 py-2.5 mb-3"
								>
									<p className="text-[15px] text-gray-900 font-medium mb-[2px] leading-tight">
										{task.name}
									</p>
									<p className="text-[13px] text-gray-500 flex items-center gap-1">
										<span className="text-[18px] leading-none">•</span> Due:{" "}
										{task.time}
									</p>
								</div>
							))}
						</div>

						{/* Button */}
						<button
							className="mt-5 w-full rounded-full text-[15px] font-medium text-[#1E1E1E] tracking-[0.01em] transition-all duration-150 hover:bg-[#F8F8F8] active:scale-[0.99]"
							style={{
								border: "1px solid #1E1E1E",
								padding: "4px 0",
								lineHeight: "1.1",
							}}
						>
							View All
						</button>
					</div>

					{/* Reminders */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between hover:shadow-md transition-all duration-200">
						<div>
							{/* Header */}
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-[17px] md:text-[18px] font-semibold flex items-center gap-2 text-gray-900">
									<Image
										src="/Icons/Property 1=Reminder.svg"
										alt="Reminders"
										width={20}
										height={20}
										className="opacity-90"
									/>
									Reminders
								</h3>

								{/* Count Badge */}
								<span className="text-[13px] bg-[#F7D76C] text-[#000000] font-semibold px-[9px] py-[3px] rounded-full shadow-sm">
									8
								</span>
							</div>

							{/* Reminder List */}
							{[
								{ name: "Check email summaries", time: "Today, 9:00 AM" },
								{ name: "Follow up with Megan", time: "Today, 12:00 PM" },
								{ name: "Submit design updates", time: "Today, 4:30 PM" },
							].map((reminder, i) => (
								<div
									key={i}
									className="bg-[#F8F9FB] border border-gray-200 rounded-xl px-4 py-2.5 mb-3"
								>
									<p className="text-[15px] text-gray-900 font-medium mb-[2px] leading-tight">
										{reminder.name}
									</p>
									<p className="text-[13px] text-gray-500 flex items-center gap-1">
										<span className="text-[18px] leading-none">•</span> Due:{" "}
										{reminder.time}
									</p>
								</div>
							))}
						</div>

						{/* Button */}
						<button
							className="mt-5 w-full rounded-full text-[15px] font-medium text-[#1E1E1E] tracking-[0.01em] transition-all duration-150 hover:bg-[#F8F8F8] active:scale-[0.99]"
							style={{
								border: "1px solid #1E1E1E",
								padding: "4px 0",
								lineHeight: "1.1",
							}}
						>
							View All
						</button>
					</div>
				</div>
			</main>

			{/* Bottom Nav (Mobile only) */}

			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around items-center py-3 z-50">
				{["Dashboard", "Settings", "Reminder"].map((name, i) => (
					<button
						key={i}
						onClick={() => {
							if (name === "Dashboard") router.push("/dashboard");
							else router.push(`/dashboard/${name.toLowerCase()}`);
						}}
						className="flex items-center justify-center w-11 h-11 rounded-xl bg-white shadow-sm hover:bg-gray-100 transition-all active:bg-gray-200"
					>
						<Icon name={name} size={22} className="text-gray-700" />
					</button>
				))}

				{/* ✅ Profile icon with same style */}
				<MobileProfileMenu />
			</div>
		</div>
	);
}
