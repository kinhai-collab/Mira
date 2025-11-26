/** @format */
"use client";

import Image from "next/image";

export default function ReschedulingPanel() {
	return (
		<div
			className="
        bg-white 
        rounded-[24px] 
        border border-[#E5E5E5] 
        shadow-[0_4px_12px_rgba(0,0,0,0.04)]
        p-6 
        w-full 
        max-w-[900px]
        mx-auto
      "
		>
			<p className="text-[20px] font-semibold text-[#1F1F1F] mb-4">
				Rescheduling your meeting…
			</p>

			<div className="border-l-[2px] border-[#C9BDFC] pl-4 space-y-4">
				<div className="flex items-center gap-3">
					<div className="w-[10px] h-[10px] rounded-full bg-[#9E2A2F]" />
					<p className="text-[15px] text-[#303030]">
						Checking available time slots…
					</p>
				</div>

				<div className="flex items-center gap-3 opacity-60">
					<Image
						src="/Icons/Property 1=Done in circle.svg"
						alt="done"
						width={18}
						height={18}
					/>
					<p className="text-[15px] text-[#303030]">
						Finding a common free window…
					</p>
				</div>

				<div className="flex items-center gap-3 opacity-60">
					<Image
						src="/Icons/Property 1=Done in circle.svg"
						alt="done"
						width={18}
						height={18}
					/>
					<p className="text-[15px] text-[#303030]">Updating your calendar…</p>
				</div>
			</div>
		</div>
	);
}
