/** @format */
"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";

export default function OnboardingStep3() {
	const router = useRouter();

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Sidebar - hidden on mobile */}
			<aside className="hidden md:flex w-20 bg-[#F0ECF8] flex-col items-center justify-between py-6 border-r border-gray-200">
				{/* Top Section */}
				<div className="flex flex-col items-center space-y-6">
					{/* Mira orb → Home */}
					<div
						onClick={() => router.push("/")}
						className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 shadow-md cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_4px_rgba(200,150,255,0.4)] transition-transform"
						title="Go Home"
					/>

					{/* Sidebar icons */}
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								onClick={() => {
									if (name === "Dashboard") router.push("/dashboard");
									else router.push(`/dashboard/${name.toLowerCase()}`);
								}}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
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

				{/* Bottom Profile Icon */}
				<div
					onClick={() => router.push("/dashboard/profile")}
					className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
					title="Profile"
				>
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex flex-1 justify-center items-center px-4 md:px-10 overflow-y-auto py-10 md:py-0">
				<div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 md:p-10 w-full max-w-md sm:max-w-lg md:max-w-2xl">
					{/* Header */}
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-xs sm:text-sm text-gray-500">Step 3 of 5</p>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-3/5 transition-all"></div>
					</div>

					{/* Title + Description */}
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 text-center md:text-left">
						Link Your Email
					</h1>
					<p className="text-gray-600 mb-6 text-[14px] sm:text-[15px] text-center md:text-left">
						Connect your email account to get started with Mira
					</p>

					{/* Email Provider Options */}
					<div className="space-y-4">
						{[
							{ icon: <FcGoogle size={22} />, name: "Gmail" },
							{
								icon: <FaMicrosoft size={22} color="#0078D4" />,
								name: "Outlook",
							},
							{
								icon: <FaMicrosoft size={22} color="#F25022" />,
								name: "Microsoft 365",
							},
						].map(({ icon, name }, i) => (
							<div
								key={i}
								className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-300 rounded-lg px-4 py-3 hover:shadow-md transition cursor-pointer"
							>
								<div className="flex items-center gap-3 mb-2 sm:mb-0">
									{icon}
									<p className="font-medium text-gray-800 text-[15px]">
										{name}
									</p>
								</div>
								<button className="text-sm text-purple-600 font-medium">
									Connect
								</button>
							</div>
						))}
					</div>

					{/* Continue Button */}
					<button
						onClick={() => router.push("/onboarding/step4")}
						className="w-full bg-black text-white py-2.5 mt-6 rounded-full font-medium hover:opacity-90 transition text-sm sm:text-base"
					>
						Continue
					</button>

					<p className="text-center text-gray-500 text-xs sm:text-sm mt-2">
						You can always add more email accounts later
					</p>
				</div>
			</main>

			{/* Bottom Nav (Mobile only) */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around py-3">
				{["Dashboard", "Settings", "Reminder", "Profile"].map((name, i) => (
					<div
						key={i}
						onClick={() => {
							if (name === "Dashboard") router.push("/dashboard");
							else if (name === "Profile") router.push("/dashboard/profile");
							else router.push(`/dashboard/${name.toLowerCase()}`);
						}}
						className="flex flex-col items-center text-gray-700"
					>
						<Icon name={name} size={20} />
					</div>
				))}
			</div>
		</div>
	);
}
