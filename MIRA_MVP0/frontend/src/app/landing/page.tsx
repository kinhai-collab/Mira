/** @format */
"use client";

import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";

export default function LandingPage() {
	const router = useRouter();

	return (
		<main className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 md:px-10 text-center bg-gradient-to-b from-[#d5c6f3] to-[#f8d3e4]">
			<div className="max-w-3xl w-full relative">
				{/* Heading */}
				<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-900 leading-tight sm:leading-snug mb-4 sm:mb-5 md:mb-6">
					Welcome to Mira
				</h1>

				{/* Subheading */}
				<p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-700 mb-8 sm:mb-10 md:mb-12 px-2 sm:px-0 leading-relaxed">
					Proactive personal assistant that handles your
					<br className="hidden sm:block" />
					<span className="font-semibold"> tasks, emails,</span> and{" "}
					<span className="font-semibold">events</span> for you.
				</p>

				{/* Feature Icons */}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-10 text-[#7a2048] font-normal mb-10 sm:mb-12">
					{/* Mic */}
					<div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base">
						<Icon name="Mic" size={18} />
						<span>Just say it (or type it)</span>
					</div>

					{/* Divider for mobile */}
					<div className="w-10 h-[1px] sm:hidden bg-[#7a2048]/30"></div>

					{/* Focus */}
					<div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base">
						<Icon name="Focus" size={18} />
						<span>Stay organized and focused</span>
					</div>

					{/* Divider for mobile */}
					<div className="w-10 h-[1px] sm:hidden bg-[#7a2048]/30"></div>

					{/* History */}
					<div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base">
						<Icon name="History" size={18} />
						<span>Reclaim your time back</span>
					</div>
				</div>
				{/* Tagline */}
				{/* Tagline */}
				<div className="relative w-full mt-16 pb-10 sm:pb-16 md:pb-20">
					<p
						className="
      absolute 
      right-[100px] sm:right-[5%] md:right-[8%] lg:right-[10%] 
      text-[#7a2048] 
      font-normal 
      text-xs sm:text-sm md:text-base lg:text-lg 
      whitespace-nowrap
    "
					>
						to do things you love
					</p>
				</div>

				{/* Button */}
				<div className="flex justify-center">
					<button
						onClick={() => router.push("/login")}
						className="bg-black text-white px-6 sm:px-8 md:px-10 py-2.5 sm:py-3.5 md:py-4 rounded-full font-semibold text-sm sm:text-base md:text-lg hover:scale-105 transition-transform duration-300 shadow-md hover:shadow-lg"
					>
						Get Started
					</button>
				</div>
			</div>
		</main>
	);
}
