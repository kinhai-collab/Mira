/** @format */
"use client";

import Image from "next/image";

export default function ThinkingPanel() {
	const tasks = [
		"Analyzing your calendar for today…",
		"Prioritizing 3 urgent emails…",
		"Suggesting optimal meeting time…",
		"Processing daily brief…",
	];

	return (
		<div
			className="
				relative bg-white rounded-2xl border border-gray-100 
				shadow-[0_4px_40px_#BAB2DA]/30 
				p-4 sm:p-6 md:p-8 
				w-full max-w-[95%] sm:max-w-[720px] md:max-w-[840px] lg:max-w-[960px] 
				mx-auto 
				transition-all duration-700 ease-in-out
			"
		>
			{/* Status Row */}
			<div
				className="
					flex items-center gap-2 
					text-[#6245A7] 
					text-xs sm:text-sm md:text-base 
					font-normal mb-3 sm:mb-4
				"
			>
				<span
					className="
						w-2 h-2 sm:w-2.5 sm:h-2.5 
						rounded-full bg-[#6245A7] 
						shadow-[0_0_8px_#7C5BEF]
					"
				/>
				<span>Thinking…</span>
			</div>

			{/* Title */}
			<p
				className="
					text-[#2F2F2F] font-normal 
					mb-3 sm:mb-4 
					text-[13px] sm:text-[15px] md:text-[16px]
				"
			>
				Preparing your morning brief…
			</p>

			{/* Task List with Left Guide Line */}
			<div
				className="
					relative pl-4 sm:pl-5 
					border-l-[1.5px] sm:border-l-2 border-[#6245A7]/40 
					space-y-1.5 sm:space-y-2
				"
			>
				{tasks.map((task, i) => (
					<div
						key={i}
						className={`flex items-center gap-2 ${
							i === tasks.length - 1 ? "opacity-60" : ""
						}`}
					>
						<Image
							src="/Icons/Property 1=Done.svg"
							alt="Done"
							width={13}
							height={13}
							className={`sm:w-[15px] sm:h-[15px] ${
								i === tasks.length - 1 ? "opacity-50" : ""
							}`}
						/>
						<span
							className="
								text-[12px] sm:text-[14px] md:text-[15px] 
								text-gray-700
							"
						>
							{task}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
