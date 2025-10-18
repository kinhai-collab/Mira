/** @format */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function ProfileMenu() {
	const [open, setOpen] = useState(false);
	const [showLogoutModal, setShowLogoutModal] = useState(false);
	const router = useRouter();
	const menuRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState("Dashboard");

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleLogout = () => {
		setShowLogoutModal(false);
		localStorage.removeItem("token");
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
					<img
						src="/Icons/Property 1=Profile.svg"
						alt="Profile"
						className="w-5 h-5 opacity-80"
					/>
				</button>

				{/* Dropdown */}
				{open && (
					<div className="absolute left-[70px] bottom-0 w-60 bg-white text-gray-700 rounded-xl shadow-md border border-gray-200 py-2 z-50 animate-fadeIn">
						<div className="px-4 pb-2 border-b border-gray-200">
							<div className="flex flex-col gap-0.5 text-gray-700 text-sm">
								<div className="flex items-center gap-2">
									<img
										src="/Icons/Property 1=Profile.svg"
										alt="User"
										className="w-4 h-4 opacity-80"
									/>
									<span>miraisthbest@gmail.com</span>
								</div>
								<span className="pl-6 text-gray-500 text-xs">
									Anusha Shivakumar
								</span>
							</div>
						</div>

						<button
							onClick={() => router.push("/switch-account")}
							className="flex items-center gap-3 w-full px-4 py-2 mt-2 text-sm hover:bg-gray-50 rounded-md transition"
						>
							<img
								src="/Icons/Property 1=SwitchAccount.svg"
								alt="Switch account"
								className="w-4 h-4 opacity-80"
							/>
							<span>Switch account</span>
						</button>

						<button
							onClick={() => setShowLogoutModal(true)}
							className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition"
						>
							<img
								src="/Icons/Property 1=LogOut.svg"
								alt="Logout"
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
								miraisthbest@gmail.com
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
