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
// Mock email data matching the image
const mockEmails = [
	{ id: 1, sender: "Jhon Mayer", senderEmail: "jhon.mayer@company.com", subject: "Q4 Budget Review", priority: "high", timeAgo: 18, avatar: "JM", dateTime: "Oct 26, 2025, 2:11PM", body: "Dear Team,\n\nI hope this email finds you well. I'm writing to request a comprehensive review of our Q4 budget allocations and expenditures.\n\nAs we approach the end of the quarter, it's crucial that we ensure all departments are aligned with their financial targets. Please review the attached budget document and provide your feedback by the end of this week.\n\nKey areas to focus on:\n- Marketing spend\n- Development resources\n- Infrastructure costs\n- Team expansion plans\n\nLooking forward to your input.\n\nBest regards,\nJhon Mayer\nFinance Director" },
	{ id: 2, sender: "Michael Brown", senderEmail: "michael.brown@company.com", subject: "User Feedback Analysis", priority: "medium", timeAgo: 30, avatar: "MB", dateTime: "Oct 26, 2025, 1:43PM", body: "Hi Team,\n\nI've compiled the user feedback from our recent product launch. The overall sentiment is positive, but there are some areas we should address.\n\nKey findings:\n- 85% user satisfaction rate\n- Main concerns: Performance issues\n- Feature requests: Dark mode, mobile app improvements\n\nPlease review the attached document.\n\nThanks,\nMichael" },
	{ id: 3, sender: "Sarah Johnson", senderEmail: "sarah.johnson@company.com", subject: "Project Timeline Update", priority: "high", timeAgo: 60, avatar: "SJ", dateTime: "Oct 26, 2025, 12:53PM", body: "Team,\n\nImportant update on our project timeline. We've encountered some delays that will require adjustments to our original schedule.\n\nPlease see the updated timeline in the attached document.\n\nBest,\nSarah" },
	{ id: 4, sender: "David Lee", senderEmail: "david.lee@company.com", subject: "Weekly Team Meeting", priority: "low", timeAgo: 120, avatar: "DL", dateTime: "Oct 26, 2025, 11:33AM", body: "Hello Everyone,\n\nJust a reminder about our weekly team meeting this Friday at 10:00 AM.\n\nAgenda items will be shared tomorrow.\n\nSee you there!\nDavid" },
	{ id: 5, sender: "Emily Chen", senderEmail: "emily.chen@company.com", subject: "Client Proposal Draft", priority: "medium", timeAgo: 180, avatar: "EC", dateTime: "Oct 26, 2025, 10:03AM", body: "Hi Team,\n\nI've prepared a draft proposal for the new client project. Please review and provide feedback.\n\nThanks,\nEmily" },
	{ id: 6, sender: "Robert Taylor", senderEmail: "robert.taylor@company.com", subject: "System Maintenance Notice", priority: "low", timeAgo: 360, avatar: "RT", dateTime: "Oct 26, 2025, 7:03AM", body: "Dear All,\n\nThis is to inform you that scheduled system maintenance will occur this weekend.\n\nExpected downtime: 2 hours\nTime: Saturday, 2:00 AM - 4:00 AM\n\nThank you for your understanding.\nRobert" },
	{ id: 7, sender: "Jennifer White", senderEmail: "jennifer.white@company.com", subject: "Quarterly Report Review", priority: "high", timeAgo: 90, avatar: "JW", dateTime: "Oct 26, 2025, 12:23PM", body: "Team,\n\nThe quarterly report is ready for review. Please provide your input by end of day.\n\nRegards,\nJennifer" },
	{ id: 8, sender: "Thomas Anderson", senderEmail: "thomas.anderson@company.com", subject: "Marketing Campaign Update", priority: "medium", timeAgo: 45, avatar: "TA", dateTime: "Oct 26, 2025, 1:28PM", body: "Hello,\n\nUpdate on our current marketing campaign performance. The numbers are looking good!\n\nBest,\nThomas" },
	{ id: 9, sender: "Lisa Garcia", senderEmail: "lisa.garcia@company.com", subject: "Invoice Payment Reminder", priority: "medium", timeAgo: 150, avatar: "LG", dateTime: "Oct 26, 2025, 11:03AM", body: "Hi,\n\nFriendly reminder about the upcoming invoice payment.\n\nThanks,\nLisa" },
	{ id: 10, sender: "James Wilson", senderEmail: "james.wilson@company.com", subject: "Product Launch Planning", priority: "low", timeAgo: 240, avatar: "JW", dateTime: "Oct 26, 2025, 9:23AM", body: "Team,\n\nLet's start planning for our next product launch. Initial ideas welcome.\n\nBest,\nJames" },
	{ id: 11, sender: "Maria Martinez", senderEmail: "maria.martinez@company.com", subject: "Customer Support Tickets", priority: "medium", timeAgo: 75, avatar: "MM", dateTime: "Oct 26, 2025, 12:48PM", body: "Hi,\n\nSummary of customer support tickets for this week.\n\nThanks,\nMaria" },
	{ id: 12, sender: "Kevin Thompson", senderEmail: "kevin.thompson@company.com", subject: "Team Building Event", priority: "low", timeAgo: 300, avatar: "KT", dateTime: "Oct 26, 2025, 8:23AM", body: "Hello Everyone,\n\nPlanning a team building event next month. Please share your preferences!\n\nKevin" },
];

type PriorityFilter = "All" | "High" | "Medium" | "Low";

export default function Dashboard() {
	const router = useRouter();
	const [currentTime, setCurrentTime] = useState(new Date());
	const [serverGreeting] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"overview" | "emails">("overview");
	const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
	const [selectedDate, setSelectedDate] = useState<string>("2025-10-26");
	const [showCalendar, setShowCalendar] = useState<boolean>(false);
	const [calendarMonth, setCalendarMonth] = useState<number>(9); // October (0-indexed)
	const [calendarYear, setCalendarYear] = useState<number>(2025);
	const [calendarEvents, setCalendarEvents] = useState<Record<string, string[]>>({
		'2025-10-15': ['Team Meeting', 'Project Review'],
		'2025-10-26': ['Email Review'],
		'2025-10-24': ['Weekly Sync'],
	});
	const [selectedEmail, setSelectedEmail] = useState<typeof mockEmails[0] | null>(null);
	const [showEmailModal, setShowEmailModal] = useState<boolean>(false);

	const [firstName, setFirstName] = useState<string | null>(null);
    const [, setGreeting] = useState<string>("");

	// Check authentication on mount
	useEffect(() => {
		if (!isAuthenticated()) {
			router.push("/login");
			return;
		}
	}, [router]);

	// Close calendar when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (showCalendar && !target.closest('.calendar-container')) {
				setShowCalendar(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showCalendar]);

	// Close email modal on ESC key
	useEffect(() => {
		if (!showEmailModal) return;
		
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setShowEmailModal(false);
				setSelectedEmail(null);
			}
		};
		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [showEmailModal]);

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

	// Format time ago (e.g., "18m ago", "1h ago")
	const formatTimeAgo = (minutes: number): string => {
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	};

	// Format full timestamp for email modal (e.g., "Oct 26, 2025, 2:11PM (2 days ago)")
	const formatFullTimestamp = (dateTime: string, timeAgo: number): string => {
		const timeAgoStr = formatTimeAgo(timeAgo);
		return `${dateTime} (${timeAgoStr})`;
	};

	// Handle email view click
	const handleEmailView = (email: typeof mockEmails[0]) => {
		setSelectedEmail(email);
		setShowEmailModal(true);
	};

	// Close email modal
	const closeEmailModal = () => {
		setShowEmailModal(false);
		setSelectedEmail(null);
	};

	// Filter emails based on priority
	const filteredEmails = priorityFilter === "All" 
		? mockEmails 
		: mockEmails.filter(email => email.priority.toLowerCase() === priorityFilter.toLowerCase());

	// Format date for header - matching image exactly: "Wed, Oct 15"
	const formatHeaderDate = (): string => {
		// Use fixed date from image: "Wed, Oct 15"
		return "Wed, Oct 15";
	};

	// Format date for display: "Oct 26, 2025"
	const formatSelectedDate = (dateString: string): string => {
		const date = new Date(dateString);
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
	};

	// Calendar component functions
	const getDaysInMonth = (year: number, month: number): number => {
		return new Date(year, month + 1, 0).getDate();
	};

	const getFirstDayOfMonth = (year: number, month: number): number => {
		return new Date(year, month, 1).getDay();
	};

	const handleDateSelect = (day: number, month?: number, year?: number) => {
		const selectedMonth = month !== undefined ? month : calendarMonth;
		const selectedYear = year !== undefined ? year : calendarYear;
		const date = new Date(selectedYear, selectedMonth, day);
		setSelectedDate(date.toISOString().split('T')[0]);
		// Update calendar view if selecting from different month
		if (month !== undefined && month !== calendarMonth) {
			setCalendarMonth(month);
		}
		if (year !== undefined && year !== calendarYear) {
			setCalendarYear(year);
		}
		setShowCalendar(false);
	};

	const navigateMonth = (direction: 'prev' | 'next') => {
		if (direction === 'prev') {
			if (calendarMonth === 0) {
				setCalendarMonth(11);
				setCalendarYear(calendarYear - 1);
			} else {
				setCalendarMonth(calendarMonth - 1);
			}
		} else {
			if (calendarMonth === 11) {
				setCalendarMonth(0);
				setCalendarYear(calendarYear + 1);
			} else {
				setCalendarMonth(calendarMonth + 1);
			}
		}
	};

	const getCurrentDate = () => {
		const today = new Date();
		return today.toISOString().split('T')[0];
	};

	const getEventsForDate = (year: number, month: number, day: number): string[] => {
		const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return calendarEvents[dateStr] || [];
	};

	// Render custom calendar - Exact match to design image (clean, no navigation)
	const renderCalendar = () => {
		const year = calendarYear;
		const month = calendarMonth;
		const daysInMonth = getDaysInMonth(year, month);
		const firstDay = getFirstDayOfMonth(year, month);
		const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
		
		// Month names for display
		const monthNames = ["January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"];
		
		// Calculate calendar grid
		const calendarDays: Array<{ day: number; type: 'prev' | 'current' | 'next'; month: number; year: number }> = [];
		
		// Previous month's last days
		const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);
		for (let i = firstDay - 1; i >= 0; i--) {
			calendarDays.push({ 
				day: prevMonthDays - i, 
				type: 'prev',
				month: month === 0 ? 11 : month - 1,
				year: month === 0 ? year - 1 : year
			});
		}
		
		// Current month days
		for (let i = 1; i <= daysInMonth; i++) {
			calendarDays.push({ 
				day: i, 
				type: 'current',
				month: month,
				year: year
			});
		}
		
		// Next month's first days - fill remaining cells (6 rows × 7 columns = 42 cells)
		const remainingCells = 42 - calendarDays.length;
		for (let i = 1; i <= remainingCells; i++) {
			calendarDays.push({ 
				day: i, 
				type: 'next',
				month: month === 11 ? 0 : month + 1,
				year: month === 11 ? year + 1 : year
			});
		}

		return (
			<div className="calendar-container absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-3 sm:p-4 z-50 w-[calc(100vw-2rem)] sm:w-72 max-w-sm">
				{/* Calendar Header - Left aligned, no navigation buttons */}
				<h3 className="text-sm sm:text-base font-semibold text-[#111827] mb-3 sm:mb-4 text-left">
					{monthNames[month]} {year}
				</h3>

				{/* Days of Week Headers */}
				<div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
					{days.map((day) => (
						<div key={day} className="text-xs sm:text-sm font-normal text-[#111827] text-center py-1">
							{day}
						</div>
					))}
				</div>

				{/* Calendar Grid - Clean, no special markings */}
				<div className="grid grid-cols-7 gap-0.5 sm:gap-1">
					{calendarDays.map((item, index) => {
						if (item.type === 'prev') {
							return (
								<button
									key={`prev-${index}`}
									onClick={() => handleDateSelect(item.day, item.month, item.year)}
									className="text-xs sm:text-sm text-[#D1D5DB] text-center py-1.5 sm:py-2 rounded hover:bg-gray-50 transition min-h-[36px] sm:min-h-[40px] touch-manipulation"
								>
									{item.day}
								</button>
							);
						}
						
						if (item.type === 'next') {
							return (
								<button
									key={`next-${index}`}
									onClick={() => handleDateSelect(item.day, item.month, item.year)}
									className="text-xs sm:text-sm text-[#D1D5DB] text-center py-1.5 sm:py-2 rounded hover:bg-gray-50 transition min-h-[36px] sm:min-h-[40px] touch-manipulation"
								>
									{item.day}
								</button>
							);
						}
						
						// Current month days - dark text, no highlights
						return (
							<button
								key={`current-${index}`}
								onClick={() => handleDateSelect(item.day, item.month, item.year)}
								className="text-xs sm:text-sm text-[#111827] text-center py-1.5 sm:py-2 rounded hover:bg-gray-50 transition min-h-[36px] sm:min-h-[40px] touch-manipulation"
							>
								{item.day}
							</button>
						);
					})}
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden">
			{/* Main Content */}
			<main className={`flex-1 px-4 sm:px-8 md:px-12 py-8 md:py-10 ${viewMode === "emails" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
				{viewMode === "overview" ? (
					<>
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
					<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-5 md:p-6 flex flex-col justify-between hover:shadow-md transition">
						<div>
							<h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 flex items-center gap-2">
								<Image
									src="/Icons/Property 1=Email.svg"
									alt="Email"
									width={20}
									height={20}
									className="w-4 h-4 sm:w-5 sm:h-5"
								/>
								Emails
							</h3>

							<p className="text-xs sm:text-sm text-gray-700 mb-1">12 important emails</p>
							<p className="text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3">
								from the last 24 hours
							</p>

							<p className="text-xs sm:text-sm font-medium mb-1">Priority Distribution</p>
							<div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
								<span className="bg-red-100 text-red-600 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
									High: 3
								</span>
								<span className="bg-yellow-100 text-yellow-700 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
									Medium: 5
								</span>
								<span className="bg-green-100 text-green-700 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
									Low: 4
								</span>
							</div>

							<div className="text-[10px] sm:text-xs md:text-[13px] text-gray-600 space-y-0.5 sm:space-y-1 mb-2">
								<p>
									Unread <span className="font-medium text-gray-800">8</span>
								</p>
								<p>
									Trend <span className="text-red-500 font-medium">▼ 15%</span>
								</p>
							</div>

							<p className="text-[10px] sm:text-xs md:text-[13px] text-gray-500">
								Top Sender:{" "}
								<span className="font-medium text-gray-800">John Mayer</span>
							</p>
						</div>

						<button 
							onClick={() => setViewMode("emails")}
							className="mt-4 sm:mt-6 w-full border border-gray-300 rounded-full py-2 sm:py-2.5 text-xs sm:text-sm hover:bg-gray-50 active:bg-gray-100 transition min-h-[44px] touch-manipulation"
						>
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
					</>
				) : (
					<>
						{/* Emails View - Fixed Layout with Two Separate Cards */}
						{/* Fixed Header Section - No Scroll */}
						<div className="flex-shrink-0 mb-4 sm:mb-6">
							{/* Top Header with Date and Weather - Grouped on Left */}
							<div className="mb-4 sm:mb-6 md:mb-8 flex flex-wrap items-center gap-2 sm:gap-3">
								{/* Date */}
								<div className="text-gray-700 text-xs sm:text-sm font-medium">
									{formatHeaderDate()}
								</div>
								{/* Location Pill */}
								<div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 rounded-full border border-gray-200">
									<Icon name="Location" size={12} className="sm:w-3.5 sm:h-3.5 text-gray-600" />
									<span className="text-gray-700 text-xs sm:text-sm font-medium">New York</span>
								</div>
								{/* Weather Pill */}
								<div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 rounded-full border border-gray-200">
									<Icon name="Sun" size={12} className="sm:w-3.5 sm:h-3.5 text-yellow-500" />
									<span className="text-gray-700 text-xs sm:text-sm font-medium">20°</span>
								</div>
							</div>

							{/* Title Section */}
							<div className="mb-2">
								<h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-800 mb-1">Emails</h1>
								<p className="text-gray-500 text-xs sm:text-sm">Check your emails Mira is working on.</p>
							</div>

							{/* Breadcrumb - Below title/subtitle */}
							<button 
								onClick={() => setViewMode("overview")}
								className="text-gray-600 text-xs sm:text-sm mb-4 sm:mb-6 hover:text-gray-800 active:text-gray-900 transition inline-block min-h-[44px] touch-manipulation py-1"
							>
								&lt; Dashboard
							</button>
						</div>

						{/* Top Card: "12 Important Emails" with Badges and Calendar */}
						<div className="flex-shrink-0 mb-4 sm:mb-5">
							<div 
								className="bg-white border border-gray-200 rounded-xl shadow-sm"
								style={{
									padding: '20px 24px',
								}}
							>
	{/* Desktop Layout - Three sections: Title | Badges | Calendar */}
	<div 
		className="hidden sm:flex items-center"
		style={{
			justifyContent: 'space-between',
			alignItems: 'center'
		}}
	>
		{/* Left Section - Title */}
		<div className="text-base font-semibold text-[#111827]" style={{ fontWeight: 600 }}>
			12 Important Emails
		</div>
		
		{/* Middle Section - Badges (moved slightly left) */}
		<div 
			className="flex items-center gap-2"
			style={{
				transform: 'translateX(-370px)' // move badges 40px left
			}}
		>
			{/* Badge Pills - Exact colors and spacing from design */}
			<span 
				className="bg-[#FEE2E2] text-[#DC2626] rounded-2xl"
				style={{
					padding: '6px 14px',
					fontSize: '13px',
					fontWeight: 500
				}}
			>
				High: 3
			</span>
			<span 
				className="bg-[#FEF3C7] text-[#D97706] rounded-2xl"
				style={{
					padding: '6px 14px',
					fontSize: '13px',
					fontWeight: 500
				}}
			>
				Medium: 5
			</span>
			<span 
				className="bg-[#D1FAE5] text-[#059669] rounded-2xl"
				style={{
					padding: '6px 14px',
					fontSize: '13px',
					fontWeight: 500
				}}
			>
				Low: 4
			</span>
		</div>
		
		{/* Right Section - Calendar (independently positioned) */}
		<div className="flex items-center gap-2 text-[#6B7280] text-sm relative calendar-container">
			<div 
				onClick={() => setShowCalendar(!showCalendar)}
				className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition min-h-[44px] touch-manipulation px-1"
			>
				<Image
					src="/Icons/Property 1=Calendar.svg"
					alt="Calendar"
					width={16}
					height={16}
					className="w-4 h-4"
				/>
				<span className="whitespace-nowrap">Oct 26, 2025</span>
			</div>
			{showCalendar && renderCalendar()}
		</div>
	</div>
	
	{/* Mobile Layout - Stacked */}
	<div className="flex flex-col sm:hidden gap-3">
		<div className="text-base font-semibold text-[#111827]" style={{ fontWeight: 600 }}>
			12 Important Emails
		</div>
		<div className="flex flex-wrap items-center gap-2">
			<span 
				className="bg-[#FEE2E2] text-[#DC2626] rounded-2xl"
				style={{
					padding: '6px 14px',
					fontSize: '13px',
					fontWeight: 500
				}}
			>
				High: 3
			</span>
			<span 
				className="bg-[#FEF3C7] text-[#D97706] rounded-2xl"
				style={{
					padding: '6px 14px',
					fontSize: '13px',
					fontWeight: 500
				}}
			>
				Medium: 5
			</span>
			<span 
				className="bg-[#D1FAE5] text-[#059669] rounded-2xl"
				style={{
					padding: '6px 14px',
					fontSize: '13px',
					fontWeight: 500
				}}
			>
				Low: 4
			</span>
		
	


			<div className="flex items-center gap-2 text-[#6B7280] text-sm relative calendar-container">
				<div 
					onClick={() => setShowCalendar(!showCalendar)}
					className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition min-h-[44px] touch-manipulation px-1"
				>
					<Image
						src="/Icons/Property 1=Calendar.svg"
						alt="Calendar"
						width={16}
						height={16}
						className="w-4 h-4"
					/>
					<span className="whitespace-nowrap">Oct 26, 2025</span>
				</div>
				{showCalendar && renderCalendar()}
			</div>
			</div>
		</div>
							</div>
						</div>

						{/* Bottom Card: Filter Tabs (Fixed) and Scrollable Email List */}
						<div className="flex-1 min-h-0 flex flex-col">
							<div 
								className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col flex-1 min-h-0"
								style={{
									overflow: 'hidden'
								}}
							>
								{/* Filter Tabs - Fixed at Top */}
								<div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
									<div className="flex gap-6 sm:gap-8 md:gap-10 overflow-x-auto">
										{(["All", "High", "Medium", "Low"] as PriorityFilter[]).map((tab) => (
											<button
												key={tab}
												onClick={() => setPriorityFilter(tab)}
												className={`text-sm sm:text-[15px] pb-2 sm:pb-3 transition-colors whitespace-nowrap min-h-[44px] touch-manipulation ${
													priorityFilter === tab
														? "text-[#111827] font-semibold border-b-2 border-[#111827]"
														: "text-[#9CA3AF] font-normal hover:text-[#6B7280]"
												}`}
											>
												{tab}
											</button>
										))}
									</div>
								</div>

								{/* Email List - Scrollable Only This Section */}
								<div className="flex-1 overflow-y-auto divide-y divide-gray-100" style={{ scrollbarWidth: 'thin' }}>
									{filteredEmails.map((email) => {
									const priorityColors = {
										high: "bg-red-500",
										medium: "bg-yellow-500",
										low: "bg-green-500",
									};
									const priorityColor = priorityColors[email.priority as keyof typeof priorityColors] || "bg-gray-500";
									
									// Generate avatar initials
									const initials = email.avatar;
									const avatarBg = email.priority === "high" 
										? "bg-red-100 text-red-700"
										: email.priority === "medium"
										? "bg-yellow-100 text-yellow-700"
										: "bg-green-100 text-green-700";

									return (
										<div 
											key={email.id} 
											className="px-6 py-4 hover:bg-gray-50 active:bg-gray-100 transition flex items-center"
											style={{
												minHeight: '72px',
												height: '72px'
											}}
										>
											{/* Priority Bar and Content Row */}
											<div className="flex items-center gap-4 flex-1 min-w-0">
												{/* Priority Bar */}
												<div className={`w-1 h-10 ${priorityColor} rounded-full flex-shrink-0`}></div>
												
												{/* Avatar */}
												<div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
													{initials}
												</div>
												
												{/* Email Content */}
												<div className="flex-1 min-w-0">
													<div className="font-semibold text-[15px] text-gray-800 mb-1 truncate">{email.sender}</div>
													<div className="text-[13px] text-gray-600 truncate">{email.subject}</div>
												</div>
											</div>
											
											{/* View Button and Time - Right-aligned, perfect vertical alignment */}
											<div 
												className="flex items-center flex-shrink-0"
												style={{
													gap: '12px',
													alignItems: 'center'
												}}
											>
													<button 
														onClick={() => handleEmailView(email)}
														className="px-6 py-2 text-[13px] font-medium border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition whitespace-nowrap flex-shrink-0"
														style={{
															borderRadius: '280px'
														}}
													>
														View
													</button>
													<div className="flex items-center gap-1.5" style={{ alignItems: 'center' }}>
														<Icon name="Clock" size={14} className="w-3.5 h-3.5 text-gray-500" />
														<span className="text-[13px] text-gray-500 whitespace-nowrap">{formatTimeAgo(email.timeAgo)}</span>
													</div>
											</div>
										</div>
									);
								})}
								</div>
							</div>
						</div>
					</>
				)}

				{/* Email View Modal */}
				{showEmailModal && selectedEmail && (
					<div 
						className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4"
						onClick={(e) => {
							if (e.target === e.currentTarget) {
								closeEmailModal();
							}
						}}
					>
						<div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden m-0 sm:m-4">
							{/* Modal Header */}
							<div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 bg-white">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 sm:gap-4 mb-2">
										{/* Avatar */}
										<div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${
											selectedEmail.priority === "high" 
												? "bg-red-100 text-red-700"
												: selectedEmail.priority === "medium"
												? "bg-yellow-100 text-yellow-700"
												: "bg-green-100 text-green-700"
										} flex items-center justify-center font-semibold text-xs sm:text-sm flex-shrink-0`}>
											{selectedEmail.avatar}
										</div>
										{/* Sender Name */}
										<div className="min-w-0 flex-1">
											<div className="font-semibold text-gray-800 text-sm sm:text-base truncate">
												{selectedEmail.sender}
											</div>
											<div className="text-xs sm:text-sm text-gray-500 truncate">
												{selectedEmail.senderEmail}
											</div>
										</div>
									</div>
									{/* Subject and Priority */}
									<div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-0 sm:ml-14">
										<div className="font-medium text-gray-800 text-sm sm:text-base break-words">{selectedEmail.subject}</div>
										<span className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
											selectedEmail.priority === "high"
												? "bg-red-500 text-white"
												: selectedEmail.priority === "medium"
												? "bg-yellow-500 text-white"
												: "bg-green-500 text-white"
										}`}>
											{selectedEmail.priority.charAt(0).toUpperCase() + selectedEmail.priority.slice(1)}
										</span>
									</div>
								</div>
								{/* Timestamp and Close Button */}
								<div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0">
									{/* Timestamp with Clock Icon */}
									<div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-gray-500">
										<Icon name="Clock" size={12} className="sm:w-3.5 sm:h-3.5 text-gray-500" />
										<span className="whitespace-nowrap">{formatFullTimestamp(selectedEmail.dateTime, selectedEmail.timeAgo)}</span>
									</div>
									{/* Close Button */}
									<button
										onClick={closeEmailModal}
										className="p-2 sm:p-1 hover:bg-gray-100 active:bg-gray-200 rounded transition text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center"
										aria-label="Close"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>

							{/* Modal Content */}
							<div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 bg-white">
								<div className="text-sm sm:text-base text-gray-600 whitespace-pre-wrap leading-relaxed">
									{selectedEmail.body || "Place for your email content"}
								</div>
							</div>
						</div>
					</div>
				)}
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
