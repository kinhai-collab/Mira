/** @format */
"use client";

import Image from "next/image";

export default function RecommendationPanel({
	onAccept,
}: {
	onAccept: () => void;
}) {
	return (
		<div
			className="
				relative bg-white text-sm rounded-2xl border border-gray-100 
				shadow-[0_4px_20px_rgba(0,0,0,0.05)] 
				p-4 sm:p-6 md:p-8 
				w-full max-w-[95%] sm:max-w-[720px] md:max-w-[840px] lg:max-w-[960px] 
				mx-auto 
				transition-all duration-700 ease-in-out
			"
		>
			{/* Header Section */}
			<p className="text-[#2F2F2F] font-normal text-sm sm:text-base mb-3 sm:mb-4">
				Prepared your morning brief
			</p>

			{/* Task List with Vertical Line */}
			<div className="relative pl-4 sm:pl-5 mb-3 sm:mb-4">
				<div className="absolute left-0 top-[4px] bottom-[4px] w-[1.5px] bg-[#6245A7]/40 rounded-full" />

				<ul className="text-gray-700 text-xs sm:text-sm md:text-base space-y-1.5">
					<li className="flex items-center gap-2">
						<Image
							src="/Icons/Property 1=Done.svg"
							alt="Done"
							width={14}
							height={14}
						/>
						<span>Suggested optimal meeting time.</span>
					</li>
					<li className="flex items-center gap-2">
						<Image
							src="/Icons/Property 1=Done.svg"
							alt="Done"
							width={14}
							height={14}
						/>
						<span>Processed daily brief.</span>
					</li>
				</ul>

				<p className="text-[#6245A7] text-[11px] sm:text-xs font-medium mt-1 flex items-center gap-1 cursor-pointer">
					See More <span>⌄</span>
				</p>
			</div>

			{/* Conflict Section */}
			<div className="mt-4 sm:mt-6">
				<p className="text-[#2F2F2F] text-[13px] sm:text-sm md:text-base font-normal mb-1 flex items-start gap-2 leading-snug">
					<span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#6245A7] shadow-[0_0_8px_#7C5BEF] mt-[4px]" />
					I found a conflict at 10 AM. Shall I move it to 2 PM?
				</p>

				<p className="text-gray-500 text-[12px] sm:text-sm ml-5 mb-3 leading-relaxed">
					You have a calendar conflict — there’s another event scheduled at 10
					AM.
				</p>

				<div className="flex flex-wrap gap-2 mb-4 ml-5">
					{["Move to 3 PM", "Move to 4 PM", "Cancel meeting."].map((option) => (
						<button
							key={option}
							className="px-3 sm:px-4 py-1.5 border border-gray-300 rounded-full text-xs sm:text-sm text-gray-800 hover:bg-gray-100 transition"
						>
							{option}
						</button>
					))}
				</div>

				<div className="flex flex-wrap gap-3 ml-5">
					<button
						onClick={onAccept}
						className="px-4 sm:px-5 py-2 rounded-full bg-black text-white font-medium text-xs sm:text-sm md:text-base hover:bg-gray-800 transition"
					>
						Accept
					</button>
					<button className="px-4 sm:px-5 py-2 rounded-full border border-gray-300 text-gray-700 font-medium text-xs sm:text-sm md:text-base hover:bg-gray-100 transition">
						Decline
					</button>
				</div>
			</div>
		</div>
	);
}
