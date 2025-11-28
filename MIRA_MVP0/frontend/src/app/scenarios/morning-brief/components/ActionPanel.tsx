/** @format */
interface ActionPanelData {
	resolved?: string;
}

export default function ActionPanel({ data }: { data?: ActionPanelData }) {
	return (
		<div
			className="
				bg-white rounded-2xl shadow-lg border border-gray-100 
				p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-4 
				transition-all duration-500 ease-in-out
				w-full max-w-[680px] mx-auto
			"
		>
			{/* Header */}
			<h4
				className="
					text-[#62445E] font-normal 
					text-base sm:text-lg 
					mb-1 sm:mb-2
				"
			>
				Prepared your morning brief
			</h4>

			{/* Task list */}
			<ul
				className="
					text-gray-700 
					text-sm sm:text-base 
					mb-2 sm:mb-3 space-y-1
				"
			>
				<li>○ Suggested optimal meeting time.</li>
				<li>○ Processed daily brief.</li>
			</ul>

			{/* Conflict message */}
			<p
				className="
					text-[#2F2F2F] 
					font-medium 
					text-sm sm:text-base 
					leading-snug
				"
			>
				I found a conflict at 10 AM. Shall I move it to 2 PM?
			</p>

			{/* Resolution message */}
			<p
				className="
					text-green-600 
					text-xs sm:text-sm 
					font-medium
				"
			>
				{data?.resolved || "Team sync moved to 2 PM."}
			</p>

			{/* Undo */}
			<button
				className="
					text-[#62445E] underline 
					text-xs sm:text-sm 
					mt-2 hover:text-[#4A334A]
				"
			>
				↩ Undo
			</button>
		</div>
	);
}
