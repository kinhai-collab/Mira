/** @format */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export default function OnboardingStep1() {
	const router = useRouter();
	const [consents, setConsents] = useState({
		selectAll: false,
		manageDrafts: false,
		readCompose: false,
		seeDownloadOther: false,
		seeDownloadContacts: false,
	});

	const handleConsentChange = (key: string, value: boolean) => {
		if (key === "selectAll") {
			setConsents({
				selectAll: value,
				manageDrafts: value,
				readCompose: value,
				seeDownloadOther: value,
				seeDownloadContacts: value,
			});
		} else {
			const newConsents = { ...consents, [key]: value };
			// Update selectAll based on individual checkboxes
			newConsents.selectAll = newConsents.manageDrafts && 
				newConsents.readCompose && 
				newConsents.seeDownloadOther && 
				newConsents.seeDownloadContacts;
			setConsents(newConsents);
		}
	};

	const handleContinue = () => {
		console.log("Consents:", consents);
		try { 
			localStorage.setItem("mira_onboarding_step1", JSON.stringify({ consents })); 
		} catch {};
		console.log("Consents:", consents);
		router.push("/onboarding/step2");
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Sidebar - visible only on md+ */}
			<aside className="hidden md:flex w-20 bg-[#F0ECF8] flex-col items-center justify-between py-6 border-r border-gray-200">
				{/* Top Section */}
				<div className="flex flex-col items-center space-y-6">
					{/* Mira orb → Home */}
					<div
						onClick={() => router.push("/")}
						className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 shadow-md cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_4px_rgba(200,150,255,0.4)] transition-transform"
						title="Go Home"
					/>
					{/* Icons */}
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								onClick={() => {
									if (name === "Dashboard") router.push("/dashboard");
									else router.push(`/dashboard/${name.toLowerCase()}`);
								}}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
							>
								<Icon name={name} size={22} />
							</div>
						))}
					</div>
				</div>

				{/* Profile */}
				<div
					onClick={() => router.push("/dashboard/profile")}
					className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
					title="Profile"
				>
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			{/* Main Section */}
			<main className="flex-1 flex justify-center items-center px-4 md:px-10 overflow-y-auto py-10 md:py-0">
				<div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 md:p-10 w-full max-w-md sm:max-w-lg md:max-w-2xl">
					{/* Progress + Header */}
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-xs sm:text-sm text-gray-500">Step 1 of 5</p>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-1/5 transition-all"></div>
					</div>

					{/* Title */}
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 text-center md:text-left">
						Consent & Data Use Disclosure
					</h1>
					<p className="text-gray-600 mb-6 text-[14px] sm:text-[15px] leading-relaxed text-center md:text-left">
						Select what Mira can access to provide you with the best experience
					</p>

					{/* Form */}
					<form className="space-y-4">
						{/* Select All */}
						<div className="flex items-start gap-3">
							<input
								type="checkbox"
								checked={consents.selectAll}
								onChange={(e) => handleConsentChange("selectAll", e.target.checked)}
								className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-400"
							/>
							<p className="text-gray-800 text-[15px] font-medium">
								Select all
							</p>
						</div>

						{/* Indented Options */}
						<div className="pl-6 space-y-4">
							{[
								{ text: "Manage drafts and send emails.", key: "manageDrafts" },
								{ text: "Read, compose, and send emails from your email accounts.", key: "readCompose" },
								{ text: "See and download contact info automatically saved in your \"Other contacts.\"", key: "seeDownloadOther" },
								{ text: "See and download your contacts.", key: "seeDownloadContacts" },
							].map((item, i) => (
								<div key={i} className="flex items-start gap-3">
									<input
										type="checkbox"
										checked={consents[item.key as keyof typeof consents]}
										onChange={(e) => handleConsentChange(item.key, e.target.checked)}
										className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-400"
									/>
									<div>
										<p className="text-gray-800 text-[14px] sm:text-[15px] leading-snug">
											{item.text}
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
						<p className="text-xs sm:text-sm text-gray-500 mt-6 leading-relaxed">
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
							onClick={handleContinue}
							className="w-full bg-black text-white py-2.5 mt-6 rounded-full font-medium hover:opacity-90 transition text-sm sm:text-base"
						>
							Continue
						</button>
					</form>
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
