/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingStep4() {
	const router = useRouter();
	const [connectedCalendars, setConnectedCalendars] = useState<string[]>([]);

	const handleNavigate = (path: string) => {
		router.push(path);
	};

	const handleBack = () => {
		router.push("/onboarding/step3");
	};

	const handleContinue = () => {
		console.log("Connected calendars:", connectedCalendars);
		router.push("/onboarding/step5");
	};

	const toggleCalendarConnection = (calendarProvider: string) => {
		setConnectedCalendars(prev => 
			prev.includes(calendarProvider)
				? prev.filter(calendar => calendar !== calendarProvider)
				: [...prev, calendarProvider]
		);
	};

	const calendarProviders = [
		{
			id: 'google',
			name: 'Google Calendar',
			iconSrc:
				"/Icons/image 7.svg",
		},
		{
			id: 'outlook',
			name: 'Outlook Calendar',
			iconSrc:
				"/Icons/image 5.svg",
		},
		{
			id: 'microsoft',
			name: 'Microsoft Calendar',
			iconSrc:
				"/Icons/image 6.svg",
		},
		{
			id: 'exchange',
			name: 'Exchange Calendar',
			iconSrc:
				"/Icons/image 8.svg",
		}
	];

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
								Step 4 of 5
							</span>
						</div>
						
						{/* Progress bar */}
						<div className="flex items-center w-full">
							{Array.from({ length: 5 }, (_, index) => (
								<div key={index} className="flex-1 flex items-center">
									<div
										className={`h-[10px] w-full ${
											index < 4
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
									Link Your Calendar
								</h1>
								<p className="text-[18px] leading-[12px] text-[#272829] font-['Outfit',_sans-serif]">
									Connect your calendar to help Mira manage your schedule
								</p>
							</div>

							{/* Calendar providers */}
							<div className="flex flex-col gap-5">
								{calendarProviders.map((provider) => (
									<div
										key={provider.id}
										className="border border-[#96989c] rounded-lg px-6 py-4 flex items-center justify-between hover:border-[#735ff8] transition-colors"
									>
										<div className="flex items-center gap-5">
											<div className="w-6 h-6 flex items-center justify-center">
												<img src={provider.iconSrc as string} alt="" className="w-6 h-6 object-contain" />
											</div>
											<span className="text-[18px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
												{provider.name}
											</span>
										</div>
										<button
											onClick={() => toggleCalendarConnection(provider.id)}
											className={`px-4 py-2 rounded-lg text-[14px] font-['Outfit',_sans-serif] transition-colors ${
												connectedCalendars.includes(provider.id)
													? "bg-[#735ff8] text-white hover:bg-[#5a4fd6]"
													: "bg-[#f7f8fa] border border-[#c4c7cc] text-[#454547] hover:bg-[#e6e9f0]"
											}`}
										>
											{connectedCalendars.includes(provider.id) ? "Connected" : "Connect"}
										</button>
									</div>
								))}
							</div>

							{/* Continue button and note */}
							<div className="flex flex-col gap-5">
								<button
									onClick={handleContinue}
									className="bg-[#272829] text-[#fbfcfd] h-[54px] rounded-[50px] text-[18px] font-normal font-['Outfit',_sans-serif] hover:bg-[#454547] transition-colors"
								>
									Continue
								</button>
								
								<div className="p-2">
									<p className="text-[14px] text-[#5b5c5f] text-center font-['Outfit',_sans-serif]">
										You can always add more calendar accounts later
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}