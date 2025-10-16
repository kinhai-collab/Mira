/** @format */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to login page when the app starts
		router.replace("/login");
	}, [router]);

	return (
		<div className="flex items-center justify-center h-screen bg-[#F8F8FB]">
			<div className="text-center">
				<div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5] shadow-[0_0_40px_8px_rgba(210,180,255,0.45)] animate-pulse mx-auto mb-4"></div>
				<p className="text-gray-600 font-medium">Redirecting to login...</p>
			</div>
		</div>
	);
}
