/** @format */

"use client";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { FaBell, FaMicrophone, FaBolt } from "react-icons/fa";

export default function OnboardingStep5() {
	const router = useRouter();

	return (
		<div className="flex h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			<aside className="w-20 bg-[#F0ECF8] flex flex-col items-center justify-between py-6 border-r border-gray-200">
				<div className="flex flex-col items-center space-y-6">
					<div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400" />
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
							>
								<Icon name={name} size={22} />
							</div>
						))}
					</div>
				</div>
				<div className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer">
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			<main className="flex flex-1 justify-center items-center px-4">
				<div className="bg-white rounded-lg shadow-xl p-10 w-full max-w-2xl">
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-sm text-gray-500">Step 5 of 5</p>
					</div>
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-full transition-all"></div>
					</div>

					<h1 className="text-2xl font-semibold text-gray-900 mb-3">
						Grant Permissions
					</h1>
					<p className="text-gray-600 mb-6 text-[15px]">
						Enable these features to get the most out of Mira
					</p>

					<div className="space-y-4">
						{[
							{
								icon: <FaBell size={18} />,
								title: "Push Notification",
								desc: "Get notified about important emails and reminders",
							},
							{
								icon: <FaMicrophone size={18} />,
								title: "Microphone Access",
								desc: "Use voice commands to interact with Mira",
							},
							{
								icon: <FaBolt size={18} />,
								title: "Wake Word Detection",
								desc: "Activate Mira with your voice",
							},
						].map(({ icon, title, desc }, i) => (
							<div
								key={i}
								className="flex items-center justify-between border border-gray-300 rounded-lg px-4 py-3 hover:shadow-md transition cursor-pointer"
							>
								<div className="flex items-center gap-3">
									{icon}
									<div>
										<p className="font-medium text-gray-800">{title}</p>
										<p className="text-sm text-gray-500">{desc}</p>
									</div>
								</div>
								<div className="w-5 h-5 border border-gray-400 rounded-full"></div>
							</div>
						))}
					</div>

					<button
						onClick={() => router.push("/login")}
						className="w-full bg-black text-white py-2.5 mt-6 rounded-full font-medium hover:opacity-90 transition"
					>
						Complete sign up
					</button>
					<p className="text-center text-gray-500 text-sm mt-2">
						You can manage these permissions anytime in your settings
					</p>
				</div>
			</main>
		</div>
	);
}
