/** @format */
"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import ProfileMenu from "@/components/ProfileMenu";
import { useState, useEffect } from "react";
import { getStoredUserData, clearAuthTokens, UserData } from "@/utils/auth";
function MobileProfileMenu() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const [userData, setUserData] = useState<UserData | null>(null);

	// Close when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".mobile-profile-menu")) setOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Load user data on component mount and listen for updates
	useEffect(() => {
		const loadUserData = () => {
			const storedUserData = getStoredUserData();
			setUserData(storedUserData);
		};

		// Load initial data
		loadUserData();

		// Listen for user data updates
		const handleUserDataUpdate = () => {
			loadUserData();
		};

		window.addEventListener('userDataUpdated', handleUserDataUpdate);
		
		return () => {
			window.removeEventListener('userDataUpdated', handleUserDataUpdate);
		};
	}, []);

	const handleLogout = () => {
		console.log("Logout initiated from Sidebar for user:", userData);
		clearAuthTokens();

		// Dispatch event to notify other components
		window.dispatchEvent(new CustomEvent("userDataUpdated"));

		console.log("User logged out from Sidebar, redirecting to login...");
		router.push("/login");
	};

	return (
		<div className="relative mobile-profile-menu flex flex-col items-center">
			{/* Profile Icon */}
			<button
				onClick={() => setOpen(!open)}
				className={`flex items-center justify-center w-11 h-11 rounded-lg border border-gray-100 shadow-sm bg-white transition-all ${
					open ? "bg-gray-100" : "hover:shadow-md"
				}`}
			>
                {userData?.picture ? (
                    <img
                        src={userData.picture}
                        alt="Profile"
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                    />
                ) : (
					<Icon name="Profile" size={22} />
				)}
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
                                {userData?.picture ? (
                                    <img
                                        src={userData.picture}
                                        alt="User"
                                        width={16}
                                        height={16}
                                        className="w-4 h-4 rounded-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
									<div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-xs">
										{userData?.fullName?.charAt(0) ||
											userData?.email?.charAt(0) ||
											"U"}
									</div>
								)}
								<span>{userData?.email || "No email"}</span>
							</div>
							<span className="pl-6 text-gray-500 text-xs">
								{userData?.fullName || "No name"}
							</span>
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

export default function Sidebar() {
	const router = useRouter();

	return (
		<div className="fixed left-0 top-0 flex flex-col items-center justify-between h-screen bg-[#F0ECF8] py-6 border-r border-gray-200 w-20 z-10">
			{/* Top Section */}
			<div className="flex flex-col items-center space-y-6">
				{/* Mira orb */}
				<div
					onClick={() => router.push("/")}
					className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 shadow-md cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_4px_rgba(200,150,255,0.4)] transition-transform"
					title="Go Home"
				/>
				{/* Navigation icons */}
				<div className="flex flex-col items-center gap-5 mt-4">
					{["Dashboard", "Settings", "Reminder"].map((name, i) => (
						<div
							key={i}
							onClick={() => {
								if (name === "Dashboard") router.push("/dashboard");
								else router.push(`/dashboard/${name.toLowerCase()}`);
							}}
							className={`p-3 w-11 h-11 flex items-center justify-center rounded-lg border border-gray-100 shadow-sm transition-all cursor-pointer bg-white hover:shadow-md hover:bg-gray-100`}
						>
							<Icon
								name={name}
								size={22}
								className="opacity-80 hover:opacity-100 transition"
							/>
						</div>
					))}
				</div>
			</div>

			{/* Bottom Profile */}
			<div className="pt-4">
				<ProfileMenu />
			</div>

			{/* Bottom Nav (Mobile only) */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around items-center py-3 z-[999] shadow-lg">
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
