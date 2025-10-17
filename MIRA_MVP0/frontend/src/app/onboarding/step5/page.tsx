/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingStep5() {
	const router = useRouter();
	const [permissions, setPermissions] = useState({
		pushNotifications: true,
		microphoneAccess: false,
		wakeWordDetection: false,
	});
	const handleFinish = async () => {
		try {
			const email = (() => { try { return localStorage.getItem("mira_email") || ""; } catch { return ""; } })();
			if (!email) { alert("Missing email from signup. Please sign up again."); router.push("/signup"); return; }
			const payload = { email, permissions };
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding_save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.detail?.message || data?.message || "Failed to save onboarding");
			// Go to dashboard
			router.push("/dashboard");
		} catch (e:any) {
			alert(e?.message || "Failed to finish onboarding");
		}
	};
	const handleNavigate = (path: string) => {
		router.push(path);
	};

	const handleBack = () => {
		router.push("/onboarding/step4");
	};

	const handleComplete = () => {
		console.log("Permissions:", permissions);
		router.push("/dashboard");
	};

	const togglePermission = (key: keyof typeof permissions) => {
		setPermissions(prev => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const permissionItems = [
		{
			key: 'pushNotifications' as keyof typeof permissions,
			title: 'Push Notification',
			description: 'Get notified about important emails and reminders',
			iconSrc: "/Icons/image 9.svg"
		},
		{
			key: 'microphoneAccess' as keyof typeof permissions,
			title: 'Microphone Access',
			description: 'Use voice commands to interact with Mira',
			iconSrc: "/Icons/image 10.svg"
		},
		{
			key: 'wakeWordDetection' as keyof typeof permissions,
			title: 'Wake Word Detection',
			description: 'Activate Mira with your voice',
			iconSrc: "/Icons/image 11.svg"
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
								Step 5 of 5
							</span>
						</div>
						
						{/* Progress bar */}
						<div className="flex items-center w-full">
							{Array.from({ length: 5 }, (_, index) => (
								<div key={index} className="flex-1 flex items-center">
									<div
										className={`h-[10px] w-full ${
											index < 5
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
									Grant Permissions
								</h1>
								<p className="text-[18px] leading-[12px] text-[#272829] font-['Outfit',_sans-serif]">
									Enable these features to get the most out of Mira
								</p>
							</div>

							{/* Permission toggles */}
							<div className="flex flex-col gap-5">
								{permissionItems.map((item) => (
									<div
										key={item.key}
										className="border border-[#96989c] rounded-lg px-6 py-4 flex items-center justify-between hover:border-[#735ff8] transition-colors"
									>
										<div className="flex items-center gap-2">
											<div className="bg-[#f7f8fa] p-2 rounded-full">
												<img src={item.iconSrc as string} alt="" className="w-6 h-6 object-contain" />
											</div>
											<div className="flex flex-col gap-3">
												<span className="text-[18px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
													{item.title}
												</span>
												<span className="text-[14px] text-[#7a7c7f] font-['Outfit',_sans-serif]">
													{item.description}
												</span>
											</div>
										</div>
										<button
											onClick={() => togglePermission(item.key)}
											className={`w-6 h-6 rounded-full border-2 transition-colors ${
												permissions[item.key]
													? "bg-[#735ff8] border-[#735ff8]"
													: "bg-white border-[#96989c] hover:border-[#735ff8]"
											}`}
										>
											{permissions[item.key] && (
												<div className="w-full h-full flex items-center justify-center">
													<div className="w-2 h-2 bg-white rounded-full"></div>
												</div>
											)}
										</button>
									</div>
								))}
							</div>

							{/* Complete button and note */}
							<div className="flex flex-col gap-5">
								<button
									onClick={handleComplete}
									className="bg-[#272829] text-[#fbfcfd] h-[54px] rounded-[50px] text-[18px] font-normal font-['Outfit',_sans-serif] hover:bg-[#454547] transition-colors"
								>
									Complete sign up
								</button>
								
								<div className="p-2">
									<p className="text-[14px] text-[#5b5c5f] text-center font-['Outfit',_sans-serif]">
										You can change these permissions anytime in your settings
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