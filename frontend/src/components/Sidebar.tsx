/** @format */
import Link from "next/link";
import { LayoutDashboard, BookOpen, Notebook, Settings } from "lucide-react";

export const Sidebar = () => {
	const links = [
		{ name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
		{ name: "Onboarding", icon: BookOpen, href: "/onboarding" },
		{ name: "Notes", icon: Notebook, href: "/notes" },
		{ name: "Settings", icon: Settings, href: "/settings" },
	];

	return (
		<aside className="w-64 bg-[#62445E] text-white p-6 flex flex-col">
			<h1 className="text-2xl font-bold mb-10 tracking-wide">Mira</h1>
			<nav className="space-y-3">
				{links.map((link) => (
					<Link
						key={link.name}
						href={link.href}
						className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#b497bd] hover:text-[#2e1c34] transition-all"
					>
						<link.icon className="w-5 h-5" />
						<span>{link.name}</span>
					</Link>
				))}
			</nav>
		</aside>
	);
};
