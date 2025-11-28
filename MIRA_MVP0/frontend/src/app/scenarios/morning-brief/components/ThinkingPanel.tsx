/** @format */
"use client";

import Image from "next/image";

export default function ThinkingPanel() {
	return (
		<div className="scale-[0.95] mt-20 flex flex-col items-center w-full max-w-[900px] mx-auto px-4">
			<div
				className="
				bg-white 
				rounded-[24px] 
				border border-[#E5E5E5] 
				shadow-[0_4px_12px_rgba(0,0,0,0.04)]
				p-6 
				pt-5
				pb-6
				w-full 
				max-w-[760px]
				mx-auto
			"
			>
				{/* Header */}
				<div className="flex items-center gap-3 mb-2">
					<span className="w-3 h-3 rounded-full bg-[#6245A7] shadow-[0_0_6px_rgba(98,68,158,0.45)]" />
					<p className="text-[#1F1F1F] text-[17px] font-medium">Thinking…</p>
				</div>

				{/* Title */}
				<p className="text-[#1F1F1F] font-normal text-[20px] mb-4">
					Preparing your morning brief…
				</p>

				{/* Task List */}
				<div className="border-l-[1px] border-[#382099] pl-[24px] space-y-[4px]">
					{/* Task 1 */}
					<div className="flex items-center gap-3">
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={18}
							height={18}
							className="opacity-90"
						/>
						<p className="text-[#303030] text-[16px] leading-tight">
							Analyzing your calendar for today…
						</p>
					</div>

					{/* Task 2 */}
					<div className="flex items-center gap-3">
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={18}
							height={18}
							className="opacity-90"
						/>
						<p className="text-[#303030] text-[16px] leading-tight">
							Prioritizing 3 urgent emails…
						</p>
					</div>

					{/* Task 3 */}
					<div className="flex items-center gap-3">
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="done"
							width={18}
							height={18}
							className="opacity-90"
						/>
						<p className="text-[#303030] text-[16px] leading-tight">
							Suggesting optimal meeting time…
						</p>
					</div>

					{/* Task 4 (faded) */}
					<div className="flex items-center gap-3 opacity-40">
						<Image
							src="/Icons/Property 1=Done in circle.svg"
							alt="pending"
							width={18}
							height={18}
						/>
						<p className="text-[#6B6B6B] text-[16px] leading-tight">
							Processing daily brief…
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
