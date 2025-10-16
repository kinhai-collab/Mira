/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingHeader } from "@/components/OnboardingHeader";

export default function OnboardingStep1() {
	const router = useRouter();
	const [consents, setConsents] = useState({
		selectAll: false,
		manageEmails: false,
		readComposeEmails: false,
		contactInfo: false,
		downloadContacts: false,
	});

	const handleNavigate = (path: string) => {
		router.push(path);
	};

	const handleBack = () => {
		router.push("/signup");
	};

	const handleContinue = () => {
		console.log("Consents:", consents);
		router.push("/onboarding/step2");
	};

	const toggleConsent = (key: keyof typeof consents) => {
		setConsents(prev => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const handleSelectAll = () => {
		const newValue = !consents.selectAll;
		setConsents({
			selectAll: newValue,
			manageEmails: newValue,
			readComposeEmails: newValue,
			contactInfo: newValue,
			downloadContacts: newValue,
		});
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
								Step 1 of 5
							</span>
						</div>
						
						{/* Progress bar */}
						<div className="flex items-center w-full">
							{Array.from({ length: 5 }, (_, index) => (
								<div key={index} className="flex-1 flex items-center">
									<div
										className={`h-[10px] w-full ${
											index < 1
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
									Consent & Data Use Disclosure
								</h1>
								<p className="text-[18px] leading-[12px] text-[#272829] font-['Outfit',_sans-serif]">
									Select what Mira can access to provide you with the best experience
								</p>
							</div>

							{/* Consent checkboxes */}
							<div className="flex flex-col gap-4">
								{/* Select All */}
								<div className="flex items-center gap-3">
									<button
										onClick={handleSelectAll}
										className="w-5 h-5 flex items-center justify-center border-2 border-[#96989c] rounded hover:border-[#735ff8] transition-colors"
									>
										{consents.selectAll && (
											<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
												<path d="M1 4.5L4.5 8L11 1" stroke="#735ff8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
										)}
									</button>
									<span className="text-[16px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
										Select all
									</span>
								</div>

								{/* Individual consents */}
								{[
									{
										key: 'manageEmails' as keyof typeof consents,
										title: 'Manage drafts and send emails.',
										learnMore: 'Learn more'
									},
									{
										key: 'readComposeEmails' as keyof typeof consents,
										title: 'Read, compose, and send emails from your email accounts.',
										learnMore: 'Learn more'
									},
									{
										key: 'contactInfo' as keyof typeof consents,
										title: 'See and download contact info automatically saved in your "Other contacts."',
										learnMore: 'Learn more'
									},
									{
										key: 'downloadContacts' as keyof typeof consents,
										title: 'See and download your contacts.',
										learnMore: 'Learn more'
									}
								].map((item, index) => (
									<div key={item.key} className="flex items-start gap-3">
										<button
											onClick={() => toggleConsent(item.key)}
											className="w-5 h-5 flex items-center justify-center border-2 border-[#96989c] rounded hover:border-[#735ff8] transition-colors mt-0.5"
										>
											{consents[item.key] && (
												<svg width="12" height="9" viewBox="0 0 12 9" fill="none">
													<path d="M1 4.5L4.5 8L11 1" stroke="#735ff8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
												</svg>
											)}
										</button>
										<div className="flex flex-col gap-1">
											<span className="text-[16px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
												{item.title}
											</span>
											<button className="text-[14px] text-[#7a7c7f] underline font-['Outfit',_sans-serif] hover:text-[#454547] transition-colors text-left">
												{item.learnMore}
											</button>
										</div>
									</div>
								))}
							</div>

							{/* Privacy notice and continue button */}
							<div className="flex flex-col gap-5">
								<div className="p-2">
									<p className="text-[18px] leading-normal text-[#272829] font-['Outfit',_sans-serif]">
										<span className="font-bold">Make sure you trust Mira:</span> Review{' '}
										<a href="#" className="text-[#735ff8] underline hover:text-[#5a4fd6] transition-colors">
											Mira's Privacy Policy
										</a>
										{' '}and{' '}
										<a href="#" className="text-[#735ff8] underline hover:text-[#5a4fd6] transition-colors">
											Terms of Service
										</a>
										{' '}to understand how Mira will process and protect your data.
									</p>
								</div>
								
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