/** @format */
"use client";

import Image from "next/image";

export default function ThinkingPanel() {
	return (
		<div className="mt-20 flex flex-col items-center w-full max-w-none mx-auto px-4">
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
				max-w-none

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
				<div className="flex gap-3">
					<div className="border-l-[1px] border-[#382099] pl-[24px] space-y-[4px]">
						<div className="flex items-center gap-3">
							<Image
								src="/Icons/Property 1=Done in circle.svg"
								alt="done"
								width={20}
								height={20}
							/>
							<p className="text-[16px] text-[#1F1F1F]">
								Analyzing your calendar for today…
							</p>
						</div>

						<div className="flex items-center gap-3">
							<Image
								src="/Icons/Property 1=Done in circle.svg"
								alt="done"
								width={20}
								height={20}
							/>
							<p className="text-[16px] text-[#1F1F1F]">
								Prioritizing 3 urgent emails…
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Image
								src="/Icons/Property 1=Done in circle.svg"
								alt="done"
								width={20}
								height={20}
							/>
							<p className="text-[16px] text-[#1F1F1F]">
								Suggesting optimal meeting time…
							</p>
						</div>
						<div className="flex items-center gap-3 opacity-40">
							<Image
								src="/Icons/Property 1=Done in circle.svg"
								alt="done"
								width={20}
								height={20}
							/>
							<p className="text-[16px] text-[#1F1F1F]">
								Processing daily brief…
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
