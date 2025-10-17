/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingStep2() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		firstName: "",
		middleName: "",
		lastName: "",
	});

	const handleNavigate = (path: string) => {
		router.push(path);
	};

	const handleBack = () => {
		router.push("/onboarding/step1");
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
		console.log("Name data:", formData);
		router.push("/onboarding/step3");
	};

	const handleInputChange = (field: keyof typeof formData, value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<div className="flex h-screen bg-gradient-to-b from-[#d0c7fa] to-[#fbdbed]">
			{/* Sidebar */}
			<div className="bg-[rgba(255,255,255,0.5)] border-r border-[rgba(196,199,204,0.5)] flex flex-col items-center justify-between h-full w-20 p-6">
				{/* Top Section */}
				<div className="flex flex-col items-center gap-6">
					<div className="relative w-10 h-10 shrink-0">
						<div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-300 rounded-full shadow-[0px_0px_10px_0px_#bab2da]"></div>
						<div className="absolute inset-1 bg-gradient-to-br from-purple-300 to-pink-200 rounded-full"></div>
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 flex justify-center items-start px-4 overflow-y-auto pt-8">
				<div className="w-full max-w-[664px]">
					{/* Header with progress bar */}
					<div className="bg-[#f7f8fa] rounded-t-lg px-8 py-4 mb-0">
						<div className="flex items-center justify-between mb-6">
							<button
								onClick={handleBack}
								className="flex items-center gap-3 text-[#454547] text-[14px] font-['Outfit',_sans-serif] hover:text-[#272829] transition-colors"
							>
								<div className="w-3 h-6">
									<svg width="12" height="24" viewBox="0 0 12 24" fill="none">
										<path d="M10 2L2 12L10 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
									</svg>
								</div>
								Back
							</button>
							<span className="text-[#454547] text-[14px] font-['Outfit',_sans-serif]">
								Step 2 of 5
							</span>
						</div>
						
						{/* Progress bar */}
						<div className="flex items-center w-full">
							{Array.from({ length: 5 }, (_, index) => (
								<div key={index} className="flex-1 flex items-center">
									<div
										className={`h-[10px] w-full ${
											index < 2
												? "bg-[#735ff8]"
												: "bg-[#dde4f6]"
										} ${
											index === 0
												? "rounded-l-lg"
												: index === 4
												? "rounded-r-lg"
												: ""
										}`}
									/>
								</div>
							))}
						</div>
					</div>

					{/* Content */}
					<div className="bg-[#f7f8fa] rounded-b-lg px-8 py-6">
						<div className="flex flex-col gap-10">
							{/* Header */}
							<div className="flex flex-col gap-4">
								<h1 className="text-[36px] leading-[40px] font-normal text-[#272829] font-['Outfit',_sans-serif]">
									What's Your Name
								</h1>
								<p className="text-[18px] leading-[12px] text-[#272829] font-['Outfit',_sans-serif]">
									Help us personalize your experience
								</p>
							</div>

							{/* Form fields */}
							<div className="flex flex-col gap-3">
								{[
									{ key: 'firstName' as keyof typeof formData, label: 'First name' },
									{ key: 'middleName' as keyof typeof formData, label: 'Middle name' },
									{ key: 'lastName' as keyof typeof formData, label: 'Last name' },
								].map((field) => (
									<div key={field.key} className="flex flex-col gap-3">
										<label className="text-[18px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
											{field.label}
										</label>
										<input
											type="text"
											value={formData[field.key]}
											onChange={(e) => handleInputChange(field.key, e.target.value)}
											className="bg-[#f7f8fa] border border-[#96989c] h-[64px] rounded-lg px-4 text-[18px] font-['Outfit',_sans-serif] focus:outline-none focus:ring-2 focus:ring-[#735ff8] focus:border-[#735ff8] transition-colors"
											placeholder={`Enter your ${field.label.toLowerCase()}`}
										/>
									</div>
								))}
							</div>

							{/* Continue button */}
							<div className="flex flex-col gap-5">
								<button
									onClick={handleContinue}
									className="bg-[#272829] text-[#fbfcfd] h-[54px] rounded-[50px] text-[18px] font-normal font-['Outfit',_sans-serif] hover:bg-[#454547] transition-colors"
								>
									Continue
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}