/** @format */

interface RecommendationPanelProps {
	data?: any;
	onAccept: () => void;
}

export default function RecommendationPanel({
	data,
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
		<div className="bg-white shadow-lg rounded-2xl p-6">
			<h2 className="font-semibold text-lg mb-3">
				Prepared your morning brief
			</h2>

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
