/** @format */

interface RecommendationPanelProps {
	data?: any;
	onAccept: () => void;
}

export default function RecommendationPanel({
	data,
	onAccept,
}: RecommendationPanelProps) {
	console.log("📊 Received Brief Data:", data);

	return (
		<div className="bg-white shadow-lg rounded-2xl p-6">
			<h2 className="font-semibold text-lg mb-3">
				Prepared your morning brief
			</h2>
			{data?.text ? (
				<p className="text-gray-700 whitespace-pre-line">{data.text}</p>
			) : (
				<p className="text-gray-400 italic">Loading summary...</p>
			)}
			<div className="mt-6 flex gap-3">
				<button
					onClick={onAccept}
					className="bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition"
				>
					Accept
				</button>
				<button className="border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-50 transition">
					Decline
				</button>
			</div>
		</div>
	);
}
