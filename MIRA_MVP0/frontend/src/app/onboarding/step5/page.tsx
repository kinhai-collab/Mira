/** @format */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { FaBell, FaMicrophone, FaBolt } from "react-icons/fa";

export default function OnboardingStep5() {
	const router = useRouter();
	const [permissions, setPermissions] = useState([]);

	const handleFinish = async () => {
		try {
			const email = (() => {
				try {
					return localStorage.getItem("mira_email") || "";
				} catch {
					return "";
				}
			})();
			if (!email) {
				alert("Missing email from signup. Please sign up again.");
				router.push("/signup");
				return;
			}

			// Collect all onboarding data from localStorage
			const step1Data = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("mira_onboarding_step1") || "{}"
					);
				} catch {
					return {};
				}
			})();
			const step2Data = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("mira_onboarding_step2") || "{}"
					);
				} catch {
					return {};
				}
			})();
			const step3Data = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("mira_onboarding_step3") || "{}"
					);
				} catch {
					return {};
				}
			})();
			const step4Data = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("mira_onboarding_step4") || "{}"
					);
				} catch {
					return {};
				}
			})();

			const payload = {
				email,
				step1: step1Data,
				step2: step2Data,
				step3: step3Data,
				step4: step4Data,
				step5: { permissions },
			};

			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");
			const endpoint = `${apiBase}/onboarding_save`;
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(
					data?.detail?.message || data?.message || "Failed to save onboarding"
				);
			// Go to dashboard
			router.push("/dashboard");
		} catch (e: any) {
			alert(e?.message || "Failed to finish onboarding");
		}
	};
	const handleNavigate = (path: string) => {
		router.push(path);
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
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
						<p className="text-xs sm:text-sm text-gray-500">Step 5 of 5</p>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-full transition-all"></div>
					</div>

					{/* Title + Description */}
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 text-center md:text-left">
						Grant Permissions
					</h1>
					<p className="text-gray-600 mb-6 text-[14px] sm:text-[15px] text-center md:text-left">
						Enable these features to get the most out of Mira
					</p>

					{/* Permissions List */}
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
								className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-300 rounded-lg px-4 py-3 hover:shadow-md transition cursor-pointer"
							>
								<div className="flex items-center gap-3 mb-2 sm:mb-0">
									{icon}
									<div>
										<p className="font-medium text-gray-800 text-[15px]">
											{title}
										</p>
										<p className="text-sm text-gray-500">{desc}</p>
									</div>
								</div>
								<div className="w-5 h-5 border border-gray-400 rounded-full"></div>
							</div>
						))}
					</div>

					{/* Final Button */}
					<button
						onClick={handleFinish}
						className="w-full bg-black text-white py-2.5 mt-6 rounded-full font-medium hover:opacity-90 transition text-sm sm:text-base"
					>
						Complete sign up
					</button>

					<p className="text-center text-gray-500 text-xs sm:text-sm mt-2">
						You can manage these permissions anytime in your settings
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
