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

		window.addEventListener('userDataUpdated', handleUserDataUpdate);
		
		return () => {
			window.removeEventListener('userDataUpdated', handleUserDataUpdate);
		};
	}, []);
	return (
		<div className="flex flex-col md:flex-row h-screen bg-[#F8F8FB] text-gray-800">
			{/* Main Content */}
			<main className="flex-1 px-4 sm:px-8 md:px-12 py-8 md:py-10 overflow-y-auto">
				{/* Header */}
				<div className="mb-8 md:mb-10 text-center md:text-left">
					<h1 className="text-2xl md:text-[28px] font-semibold mb-1">
						{serverGreeting ?? `${getGreeting()}, ${firstName ?? "there"}!`}
					</h1>
					<p className="text-gray-500 text-sm md:text-base">
						You&apos;re feeling good today. Here&apos;s your day at a glance. •{" "}
						{formatTime(currentTime)}
					</p>
				</div>

				{/* Daily Overview */}
				<section className="bg-white border border-gray-200 rounded-2xl shadow-sm px-4 sm:px-6 md:px-8 py-5 flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4 md:gap-0">
					<div className="flex flex-col sm:flex-row sm:flex-wrap md:flex-nowrap items-start md:items-center gap-4 sm:gap-8 text-sm sm:text-[15px] font-medium text-gray-700">
						<div className="flex items-center gap-2">
							<Image
								src="/Icons/Property 1=Sun.svg"
								alt="Weather"
								width={22}
								height={22}
							/>
							<span>Sunny 20°</span>
						</div>

						<div className="flex items-center gap-2">
							<Image
								src="/Icons/Property 1=Car.svg"
								alt="Commute"
								width={22}
								height={22}
							/>
							<span>25 min commute</span>
							<span className="text-gray-400 text-xs md:text-sm">
								to the office
							</span>
						</div>

						<div className="flex items-center gap-2">
							<Image
								src="/Icons/Property 1=Calendar.svg"
								alt="Meeting"
								width={22}
								height={22}
							/>
							<span>Team Standup</span>
							<span className="text-gray-400 text-xs md:text-sm">
								9:00 AM | 15 min
							</span>
						</div>
					</div>

					<button
						onClick={() => router.push("/scenarios/morning-brief")}
						className="px-4 sm:px-5 py-2 border border-gray-400 rounded-full hover:bg-gray-50 transition text-xs sm:text-sm font-medium self-center md:self-auto"
					>
						View Full Brief
					</button>
				</section>

				{/* Dashboard Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{/* Emails */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col justify-between hover:shadow-md transition">
						<div>
							<h3 className="text-base font-semibold mb-3 flex items-center gap-2">
								<Image
									src="/Icons/Property 1=Email.svg"
									alt="Email"
									width={20}
									height={20}
								/>
								Emails
							</h3>

							<p className="text-sm text-gray-700 mb-1">12 important emails</p>
							<p className="text-xs text-gray-400 mb-3">
								from the last 24 hours
							</p>

							<p className="text-sm font-medium mb-1">Priority Distribution</p>
							<div className="flex flex-wrap gap-2 mb-4">
								<span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
									High: 3
								</span>
								<span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full">
									Medium: 5
								</span>
								<span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
									Low: 4
								</span>
							</div>

							<div className="text-xs sm:text-[13px] text-gray-600 space-y-1 mb-2">
								<p>
									Unread <span className="font-medium text-gray-800">8</span>
								</p>
								<p>
									Trend <span className="text-red-500 font-medium">▼ 15%</span>
								</p>
							</div>

							<p className="text-xs sm:text-[13px] text-gray-500">
								Top Sender:{" "}
								<span className="font-medium text-gray-800">John Mayer</span>
							</p>
						</div>

						<button className="mt-6 w-full border border-gray-300 rounded-full py-2 text-xs sm:text-sm hover:bg-gray-50 transition">
							View All
						</button>
					</div>

					{/* Calendar */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col justify-between hover:shadow-md transition">
						<div>
							<h3 className="text-base font-semibold mb-3 flex items-center gap-2">
								<Image
									src="/Icons/Property 1=Calendar.svg"
									alt="Calendar"
									width={20}
									height={20}
								/>
								Calendar{" "}
								<span className="text-gray-400 text-xs">(3 RSVPs)</span>
							</h3>

							<p className="text-sm text-red-500 mb-2 font-medium">Busy Day</p>
							<p className="text-sm text-gray-600 mb-3">6.5h across 4 events</p>

							<p className="text-sm font-medium mb-1">Next Event</p>
							<p className="text-gray-800 font-medium text-[15px] mb-1">
								Team Standup
							</p>
							<p className="text-xs sm:text-[13px] text-gray-500">
								9:00 AM | Zoom
							</p>

							<div className="flex flex-wrap gap-2 mt-3">
								<span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
									2 deep work blocks
								</span>
								<span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
									1 at-risk task
								</span>
							</div>
						</div>

						<button className="mt-6 w-full border border-gray-300 rounded-full py-2 text-xs sm:text-sm hover:bg-gray-50 transition">
							View Calendar
						</button>
					</div>

					{/* Tasks */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col justify-between hover:shadow-md transition">
						<div>
							<h3 className="text-base font-semibold mb-3 flex items-center gap-2">
								<Image
									src="/Icons/Property 1=Brief.svg"
									alt="Tasks"
									width={20}
									height={20}
								/>
								Tasks <span className="text-gray-400 text-xs">(8)</span>
							</h3>

							{[
								"Task 1 name is here",
								"Task 2 name is here",
								"Task 3 name is here",
							].map((task, i) => (
								<div
									key={i}
									className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-2"
								>
									<p className="text-sm text-gray-700 font-medium">{task}</p>
									<p className="text-xs text-gray-400">Due: Today, 2:00 PM</p>
								</div>
							))}
						</div>

						<button className="mt-4 w-full border border-gray-300 rounded-full py-2 text-xs sm:text-sm hover:bg-gray-50 transition">
							View All
						</button>
					</div>

					{/* Reminders */}
					<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 flex flex-col justify-between hover:shadow-md transition">
						<div>
							<h3 className="text-base font-semibold mb-3 flex items-center gap-2">
								<Image
									src="/Icons/Property 1=Reminder.svg"
									alt="Reminders"
									width={20}
									height={20}
								/>
								Reminders <span className="text-gray-400 text-xs">(4)</span>
							</h3>

							{[
								"Reminder 1 is here",
								"Reminder 2 is here",
								"Reminder 3 is here",
							].map((reminder, i) => (
								<div
									key={i}
									className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-2"
								>
									<p className="text-sm text-gray-700 font-medium">
										{reminder}
									</p>
									<p className="text-xs text-gray-400">Due: Today, 2:00 PM</p>
								</div>
							))}
						</div>

						<button className="mt-4 w-full border border-gray-300 rounded-full py-2 text-xs sm:text-sm hover:bg-gray-50 transition">
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
