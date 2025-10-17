/** @format */
"use client";

import Link from "next/link";
import ProfileMenu from "@/components/ProfileMenu";

import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	BookOpen,
	Notebook,
	Settings,
	User,
} from "lucide-react";

export const Sidebar = () => {
	const pathname = usePathname();

	const links = [
		{ name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
		{ name: "Onboarding", icon: BookOpen, href: "/onboarding" },
		{ name: "Notes", icon: Notebook, href: "/notes" },
		{ name: "Settings", icon: Settings, href: "/settings" },
	];

	return (
		<aside className="w-64 bg-[#62445E] text-white p-6 flex flex-col justify-between">
			{/* Top Section */}
			<div>
				<h1 className="text-2xl font-bold mb-10 tracking-wide">Mira</h1>

				<nav className="space-y-3">
					{links.map((link) => {
						const isActive = pathname === link.href;

						return (
							<Link
								key={link.name}
								href={link.href}
								className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
									isActive
										? "bg-[#b497bd] text-[#2e1c34] font-medium shadow-sm"
										: "hover:bg-[#b497bd]/70 hover:text-[#2e1c34]"
								}`}
							>
								<link.icon className="w-5 h-5" />
								<span>{link.name}</span>
							</Link>
						);
					})}
				</nav>
			</div>

			{/* Bottom Profile */}
			<div className="mt-10 border-t border-[#7b5d86] pt-4">
				<ProfileMenu />
			</div>
		</aside>
	);
};
