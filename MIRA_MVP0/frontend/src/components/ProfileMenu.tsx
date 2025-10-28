/** @format */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import {
	clearAuthTokens,
	getStoredUserData,
	UserData,
	refreshUserData,
} from "@/utils/auth";

export default function ProfileMenu() {
	const [open, setOpen] = useState(false);
	const [showLogoutModal, setShowLogoutModal] = useState(false);
	const router = useRouter();
	const menuRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState("Dashboard");
	const [userData, setUserData] = useState<UserData | null>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Load user data on component mount and when localStorage changes
	useEffect(() => {
		const loadUserData = async () => {
			let storedUserData = getStoredUserData();
			console.log("ProfileMenu: Loading user data:", storedUserData);

			// If no user data is stored, try to refresh from backend
			if (
				!storedUserData ||
				(!storedUserData.fullName && !storedUserData.picture)
			) {
				console.log(
					"ProfileMenu: No user data found, attempting to refresh from backend"
				);
				const refreshedData = await refreshUserData();
				if (refreshedData) {
					storedUserData = refreshedData;
					console.log("ProfileMenu: Refreshed user data:", storedUserData);
				}
			}

			setUserData(storedUserData);
		};

		// Load initial data
		loadUserData();

		// Listen for storage changes (when user data is updated)
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key && e.key.startsWith("mira_")) {
				loadUserData();
			}
		};

		window.addEventListener("storage", handleStorageChange);

		// Also listen for custom events (for same-tab updates)
		const handleUserDataUpdate = () => {
			loadUserData();
		};

		window.addEventListener("userDataUpdated", handleUserDataUpdate);

		return () => {
			window.removeEventListener("storage", handleStorageChange);
			window.removeEventListener("userDataUpdated", handleUserDataUpdate);
		};
	}, []);

	const handleLogout = () => {
		console.log("Logout initiated for user:", userData);
		setShowLogoutModal(false);
		clearAuthTokens();

		// Dispatch event to notify other components
		window.dispatchEvent(new CustomEvent("userDataUpdated"));

		console.log("User logged out, redirecting to login...");
		router.push("/login");
	};

	return (
		<>
			{/* -------- Profile Dropdown (Desktop/Tablet) -------- */}
			<div className="relative" ref={menuRef}>
				{/* Profile Button */}
				<button
					onClick={() => setOpen(!open)}
					className={`flex items-center justify-center w-11 h-11 rounded-lg border border-gray-200 shadow-sm transition-all ${
						open ? "bg-gray-100" : "bg-white hover:bg-gray-50"
					}`}
					style={{ outline: "none" }}
				>
					{userData?.picture ? (
						<Image
							src={userData.picture}
							alt="Profile"
							width={32}
							height={32}
							className="w-8 h-8 rounded-full object-cover"
						/>
					) : (
						<div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-sm">
							{userData?.fullName?.charAt(0) ||
								userData?.email?.charAt(0) ||
								"U"}
						</div>
					)}
				</button>

				{/* Dropdown */}
				{open && (
					<div className="absolute left-[70px] bottom-0 w-60 bg-white text-gray-700 rounded-xl shadow-md border border-gray-200 py-2 z-50 animate-fadeIn">
						<div className="px-4 pb-2 border-b border-gray-200">
							<div className="flex flex-col gap-0.5 text-gray-700 text-sm">
								<div className="flex items-center gap-2">
									{userData?.picture ? (
										<Image
											src={userData.picture}
											alt="User"
											width={16}
											height={16}
											className="w-4 h-4 rounded-full object-cover"
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
							onClick={() => router.push("/switch-account")}
							className="flex items-center gap-3 w-full px-4 py-2 mt-2 text-sm hover:bg-gray-50 rounded-md transition"
						>
							<Icon name="SwitchAccount" size={20} />

							<span>Switch account</span>
						</button>

						<button
							onClick={() => alert("Delete account coming soon!")}
							className="flex items-center gap-3 w-full px-4 py-2 text-sm rounded-md hover:bg-[#f7f4fb] transition text-red-700"
						>
							<span className="text-red-700">
								<Icon name="Profile" size={18} />
							</span>
							Delete account
						</button>

						<button
							onClick={() => setShowLogoutModal(true)}
							className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition"
						>
							<Image
								src="/Icons/Property 1=LogOut.svg"
								alt="Logout"
								width={16}
								height={16}
								className="w-4 h-4 opacity-80"
							/>
							<span>Log out</span>
						</button>
					</div>
				)}
			</div>

			{/* -------- Global Bottom Nav (Mobile only) -------- */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around items-center py-3 z-50">
				{["Dashboard", "Settings", "Reminder", "Profile"].map((name, i) => (
					<button
						key={i}
						onClick={() => {
							setActive(name);
							if (name === "Dashboard") router.push("/dashboard");
							else if (name === "Profile") {
								setShowLogoutModal(true);
							} else router.push(`/dashboard/${name.toLowerCase()}`);
						}}
						className={`flex items-center justify-center w-11 h-11 rounded-xl shadow-sm transition-all ${
							active === name ? "bg-gray-200" : "bg-white hover:bg-gray-100"
						}`}
					>
						<Icon name={name} size={22} className="text-gray-700 opacity-90" />
					</button>
				))}
			</div>

			{/* -------- Logout Confirmation Modal (Global for All Views) -------- */}
			{showLogoutModal && (
				<div className="logout-modal fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[999]">
					<div
						className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm text-center animate-fadeIn"
						style={{
							boxShadow:
								"0 4px 20px rgba(0, 0, 0, 0.1), 0 0 40px rgba(0, 0, 0, 0.15)",
						}}
					>
						<h2 className="text-xl font-semibold text-gray-900 mb-2">
							Are you sure you want to log out?
						</h2>
						<p className="text-sm text-gray-600 mb-6">
							You log out Mira as <br />
							<span className="font-medium text-gray-800">
								{userData?.email || "Unknown user"}
							</span>
						</p>

						<div className="flex flex-col gap-3">
							<button
								onClick={handleLogout}
								className="w-full bg-black text-white py-2 rounded-full font-medium hover:bg-gray-800 transition"
							>
								Log out
							</button>
							<button
								onClick={() => setShowLogoutModal(false)}
								className="w-full border border-gray-300 text-gray-700 py-2 rounded-full font-medium hover:bg-gray-100 transition"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
