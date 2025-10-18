/** @format */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export default function OnboardingStep2() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		firstName: "",
		middleName: "",
		lastName: "",
	});

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleContinue = () => {
		try {
			localStorage.setItem(
				"mira_onboarding_step2",
				JSON.stringify({
					firstName: formData.firstName,
					middleName: formData.middleName,
					lastName: formData.lastName,
				})
			);
		} catch {}
		router.push("/onboarding/step3");
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Main Content */}
			<main className="flex flex-1 justify-center items-center px-4 md:px-10 overflow-y-auto py-10 md:py-0">
				<div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 md:p-10 w-full max-w-md sm:max-w-lg md:max-w-2xl">
					{/* Header + Progress */}
					<div className="flex justify-between items-center mb-4">
						<button
							onClick={() => router.back()}
							className="text-gray-600 text-sm font-medium flex items-center gap-1 hover:text-gray-800"
						>
							<Icon name="ChevronLeft" size={18} /> Back
						</button>
						<p className="text-xs sm:text-sm text-gray-500">Step 2 of 5</p>
					</div>

					{/* Progress Bar */}
					<div className="w-full bg-gray-200 h-2 rounded-full mb-8">
						<div className="bg-purple-500 h-2 rounded-full w-2/5 transition-all"></div>
					</div>

					{/* Title */}
					<h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 text-center md:text-left">
						What’s Your Name
					</h1>
					<p className="text-gray-600 mb-6 text-[14px] sm:text-[15px] text-center md:text-left">
						Help us personalize your experience
					</p>

					{/* Form Fields */}
					<form className="space-y-4">
						{[
							{ label: "First name", field: "firstName" },
							{ label: "Middle name", field: "middleName" },
							{ label: "Last name", field: "lastName" },
						].map((item, i) => (
							<div key={i}>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									{item.label}
								</label>
								<input
									type="text"
									value={formData[item.field as keyof typeof formData]}
									onChange={(e) =>
										handleInputChange(item.field, e.target.value)
									}
									className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-300"
								/>
							</div>
						))}

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

			{/* Bottom Nav (for mobile) */}
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
