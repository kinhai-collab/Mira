/** @format */
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, HelpCircle, Settings } from "lucide-react";

export default function ProfileMenu() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const menuRef = useRef<HTMLDivElement>(null);

	// Close when clicking outside
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
		localStorage.removeItem("token");
		router.push("/login");
	};

	return (
		<div className="relative" ref={menuRef}>
			{/* Profile Icon (same style as sidebar icons) */}
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center justify-center w-11 h-11 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all"
			>
				<User className="w-5 h-5 text-gray-700" />
			</button>

			{/* Dropdown Menu */}
			{open && (
				<div className="absolute left-[70px] bottom-0 w-56 bg-white/95 backdrop-blur-md text-gray-700 rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-fadeIn">
					{/* Header */}
					<div className="px-4 py-2 border-b border-gray-200">
						<p className="text-sm font-semibold text-gray-800">User Name</p>
						<p className="text-xs text-gray-500">you@example.com</p>
					</div>

					{/* Buttons */}
					<button
						onClick={() => router.push("/dashboard/settings")}
						className="flex items-center gap-3 w-full px-4 py-2 text-sm rounded-md hover:bg-[#f7f4fb] transition"
					>
						<div className="p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
							<Settings className="w-4 h-4 text-gray-700" />
						</div>
						<span>Settings</span>
					</button>

					<button
						onClick={() => router.push("/dashboard/help")}
						className="flex items-center gap-3 w-full px-4 py-2 text-sm rounded-md hover:bg-[#f7f4fb] transition"
					>
						<div className="p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
							<HelpCircle className="w-4 h-4 text-gray-700" />
						</div>
						<span>Help</span>
					</button>

					<hr className="my-2 border-gray-200" />

					<button
						onClick={handleLogout}
						className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition"
					>
						<div className="p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
							<LogOut className="w-4 h-4 text-red-500" />
						</div>
						<span>Log out</span>
					</button>
				</div>
			)}
		</div>
	);
}
