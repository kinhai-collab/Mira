/** @format */
"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function OnboardingStep1() {
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
								<Icon
									name={name}
									size={22}
									className="opacity-80 hover:opacity-100 transition"
								/>
							</div>
						))}
					</div>
				</div>
				<div
					onClick={() => router.push("/dashboard/profile")}
					className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
				>
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex flex-1 justify-center items-center px-4">
				<div className="bg-white rounded-lg shadow-xl p-10 w-full max-w-2xl">
					{/* Progress + Header */}
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-sm text-gray-500">Step 1 of 5</p>
					</div>
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-1/5 transition-all"></div>
					</div>

					{/* Title */}
					<h1 className="text-2xl font-semibold text-gray-900 mb-3">
						Consent & Data Use Disclosure
					</h1>
					<p className="text-gray-600 mb-6 text-[15px] leading-relaxed">
						Select what Mira can access to provide you with the best experience
					</p>

					{/* Checkboxes */}
					<form className="space-y-4">
						{/* Select All */}
						<div className="flex items-start gap-3">
							<input
								type="checkbox"
								className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-400"
							/>
							<p className="text-gray-800 text-[15px] font-medium">
								Select all
							</p>
						</div>

						{/* Indented Options */}
						<div className="pl-6 space-y-4">
							{[
								"Manage drafts and send emails.",
								"Read, compose, and send emails from your email accounts.",
								"See and download contact info automatically saved in your “Other contacts.”",
								"See and download your contacts.",
							].map((text, i) => (
								<div key={i} className="flex items-start gap-3">
									<input
										type="checkbox"
										className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-400"
									/>
									<div>
										<p className="text-gray-800 text-[15px] leading-snug">
											{text}
										</p>
										<a
											href="#"
											className="text-purple-500 text-sm underline hover:text-purple-600"
										>
											Learn more
										</a>
									</div>
								</div>
							))}
						</div>

						{/* Footer Notice */}
						<p className="text-sm text-gray-500 mt-6 leading-relaxed">
							Make sure you trust Mira: Review{" "}
							<a
								href="#"
								className="text-purple-600 underline hover:text-purple-700"
							>
								Mira’s Privacy Policy
							</a>{" "}
							and{" "}
							<a
								href="#"
								className="text-purple-600 underline hover:text-purple-700"
							>
								Terms of Service
							</a>{" "}
							to understand how Mira will process and protect your data.
						</p>

						{/* Continue Button */}
						<button
							type="button"
							onClick={() => router.push("/onboarding/step2")}
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
