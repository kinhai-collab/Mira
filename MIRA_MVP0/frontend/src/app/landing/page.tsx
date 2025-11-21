/** @format */
"use client";

import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LandingPage() {
	const router = useRouter();

	return (
		<main className="flex flex-col items-center justify-center min-h-screen px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 text-center bg-gradient-to-b from-[#d5c6f3] to-[#f8d3e4] relative overflow-hidden py-8 sm:py-12 md:py-16">
			<div className="max-w-3xl w-full relative z-10">
				{/* Heading */}
				<h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-semibold text-gray-900 leading-tight sm:leading-snug mb-3 sm:mb-4 md:mb-5 lg:mb-6 px-2">
					Welcome to Mira
				</h1>

				{/* Subheading */}
				<p className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-gray-700 mb-6 sm:mb-8 md:mb-10 lg:mb-12 px-2 sm:px-4 md:px-0 leading-relaxed">
					Proactive personal assistant that handles your
					<br className="hidden sm:block" />
					<span className="font-semibold"> tasks, emails,</span> and{" "}
					<span className="font-semibold">events</span> for you.
				</p>

				{/* Feature Icons */}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 xl:gap-10 text-[#7a2048] font-normal mb-8 sm:mb-10 md:mb-12 px-2">
					{/* Mic */}
					<div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 text-[10px] sm:text-xs md:text-sm lg:text-base">
						<span className="scale-75 sm:scale-90 md:scale-100">
							<Icon name="Mic" size={18} />
						</span>
						<span>Just say it (or type it)</span>
					</div>

					{/* Divider for mobile */}
					<div className="w-8 sm:w-10 h-[1px] sm:hidden bg-[#7a2048]/30"></div>

					{/* Focus */}
					<div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 text-[10px] sm:text-xs md:text-sm lg:text-base">
						<span className="scale-75 sm:scale-90 md:scale-100">
							<Icon name="Focus" size={18} />
						</span>
						<span>Stay organized and focused</span>
					</div>

					{/* Divider for mobile */}
					<div className="w-8 sm:w-10 h-[1px] sm:hidden bg-[#7a2048]/30"></div>

					{/* History */}
					<div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 text-[10px] sm:text-xs md:text-sm lg:text-base">
						<span className="scale-75 sm:scale-90 md:scale-100">
							<Icon name="History" size={18} />
						</span>
						<span>Reclaim your time back</span>
					</div>
				</div>
				
				{/* Tagline Section */}
				<div className="relative w-full mt-8 sm:mt-12 md:mt-16 pb-8 sm:pb-12 md:pb-16 lg:pb-20 min-h-[60px] sm:min-h-[80px] md:min-h-[100px]">
					{/* Tagline Text */}
					<p className="absolute right-0 sm:right-2 md:right-[5%] lg:right-[8%] xl:right-[10%] text-[#7a2048] font-normal text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg whitespace-nowrap top-0">
						to do things you love
					</p>
					
					{/* Left Heart - Positioned parallel to right heart */}
					<div className="absolute left-0 sm:left-2 md:left-4 -top-1 sm:-top-2 md:-top-1 lg:-top-2 z-0 flex items-start opacity-0 sm:opacity-100">
						<Image
							src="/Icons/heart-left.svg"
							alt=""
							width={34}
							height={56}
							className="w-[20px] h-[32px] sm:w-[24px] sm:h-[40px] md:w-[28px] md:h-[48px] lg:w-[34px] lg:h-[56px] opacity-100 brightness-150"
						/>
					</div>
					
					{/* Right Heart - Positioned next to the text */}
					<div className="absolute right-0 sm:right-2 md:right-[2%] lg:right-[3%] xl:right-[5%] -top-1 sm:-top-2 md:-top-1 lg:-top-2 z-0 flex items-start">
						<Image
							src="/Icons/heart-right.svg"
							alt=""
							width={41}
							height={52}
							className="w-[24px] h-[30px] sm:w-[28px] sm:h-[36px] md:w-[32px] md:h-[42px] lg:w-[38px] lg:h-[48px] xl:w-[41px] xl:h-[52px] opacity-100 brightness-150"
						/>
					</div>
				</div>

				{/* Button */}
				<div className="flex justify-center mt-4 sm:mt-6 md:mt-8">
					<button
						onClick={() => router.push("/signup")}
						className="bg-black text-white px-5 sm:px-6 md:px-8 lg:px-10 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 rounded-full font-semibold text-xs sm:text-sm md:text-base lg:text-lg hover:scale-105 active:scale-95 transition-transform duration-300 shadow-md hover:shadow-lg w-full max-w-[200px] sm:max-w-none"
					>
						Get Started
					</button>
				</div>
			</div>
		</main>
	);
}
