/** @format */
import "./globals.css";
import { Outfit } from "next/font/google";
import Sidebar from "@/components/Sidebar";

const outfit = Outfit({
	subsets: ["latin"],
	weight: ["100", "300"],
	display: "swap",
});

export const metadata = {
	title: "Mira Dashboard",
	description: "Mira Frontend",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body
				className={`${outfit.className} font-light min-h-screen bg-[#F8F8FB] text-gray-900 flex`}
			>
				{/* ✅ Compact lavender Sidebar */}
				<aside className="hidden md:flex">
					<Sidebar />
				</aside>

				{/* ✅ Page content */}
				<main className="flex-1 overflow-y-auto ml-20">{children}</main>
			</body>
		</html>
	);
}
