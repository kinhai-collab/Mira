/** @format */

export default function SuccessPage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#EADCF8] to-[#F8E8FB] text-gray-800">
			<div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
				<h1 className="text-3xl font-semibold mb-3">Account Created 🎉</h1>
				<p className="text-gray-500 mb-6">
					Your Mira account has been created successfully.
				</p>
				<button className="bg-black text-white px-6 py-2 rounded-full hover:opacity-90 transition">
					Go to Login
				</button>
			</div>
		</div>
	);
}
