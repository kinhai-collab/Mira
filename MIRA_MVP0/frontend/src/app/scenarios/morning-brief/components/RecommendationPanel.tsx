/** @format */
"use client";

import Image from "next/image";

export default function RecommendationPanel({
	onAccept,
	briefText,
}: {
	onAccept: () => void;
	briefText?: string;
}) {
	// Parse the brief text into sections
	const parseBriefText = (text: string) => {
		const lines = text.split("\n").filter((line) => line.trim());
		return lines;
	};

	const briefLines = briefText ? parseBriefText(briefText) : [];

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

			{/* Brief Content */}
			{briefText && (
				<div className="mb-4 sm:mb-6">
					<div className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-200">
						<div className="space-y-3 text-gray-700 text-sm sm:text-base leading-relaxed">
							{briefLines.map((line, index) => (
								<p key={index} className="mb-2">
									{line}
								</p>
							))}
						</div>
					</div>
				</div>
			)}

			<div className="flex flex-wrap gap-3">
				<button
					onClick={onAccept}
					className="px-4 sm:px-5 py-2 rounded-full bg-black text-white font-medium text-xs sm:text-sm md:text-base hover:bg-gray-800 transition"
				>
					Continue
				</button>
			</div>
		</div>
	);
}
