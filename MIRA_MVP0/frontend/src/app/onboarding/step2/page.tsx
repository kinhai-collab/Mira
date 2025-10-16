/** @format */

"use client";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function OnboardingStep2() {
	const router = useRouter();

	return (
		<div className="flex h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Sidebar */}
			<aside className="w-20 bg-[#F0ECF8] flex flex-col items-center justify-between py-6 border-r border-gray-200">
				<div className="flex flex-col items-center space-y-6">
					<div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400" />
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
							>
								<Icon name={name} size={22} />
							</div>
						))}
					</div>
				</div>
				<div className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex flex-1 justify-center items-center px-4">
				<div className="bg-white rounded-lg shadow-xl p-10 w-full max-w-2xl">
					{/* Header + Progress */}
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-sm text-gray-500">Step 2 of 5</p>
					</div>
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-2/5 transition-all"></div>
					</div>

					{/* Form */}
					<h1 className="text-2xl font-semibold text-gray-900 mb-3">
						What’s Your Name
					</h1>
					<p className="text-gray-600 mb-6 text-[15px]">
						Help us personalize your experience
					</p>

					<form className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								First name
							</label>
							<input
								type="text"
								className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-300"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Middle name
							</label>
							<input
								type="text"
								className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-300"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Last name
							</label>
							<input
								type="text"
								className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-300"
							/>
						</div>

						<button
							type="button"
							onClick={() => router.push("/onboarding/step3")}
							className="w-full bg-black text-white py-2.5 mt-6 rounded-full font-medium hover:opacity-90 transition"
						>
							Continue
						</button>
					</form>
				</div>
			</main>
		</div>
	);
}
