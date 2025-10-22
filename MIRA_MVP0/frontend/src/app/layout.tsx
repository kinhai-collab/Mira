/** @format */
import "./globals.css";
import { Outfit } from "next/font/google";
import ConditionalSidebar from "@/components/ConditionalSidebar";
import MainContent from "@/components/MainContent";

const outfit = Outfit({
	subsets: ["latin"],
	weight: ["100", "300", "400", "500", "600", "700"],
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
				{/* ✅ Conditionally rendered sidebar */}
				<ConditionalSidebar />

				{/* ✅ Page content with conditional margin */}
				<MainContent>{children}</MainContent>
			</body>
		</html>
	);
}
