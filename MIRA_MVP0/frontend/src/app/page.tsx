/** @format */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { extractTokenFromUrl, storeAuthToken, isAuthenticated } from "@/utils/auth";

export default function Home() {
	const router = useRouter();

	const [input, setInput] = useState("");
	const [isThinking, setIsThinking] = useState(false);
	const [steps, setSteps] = useState<string[]>([]);
    const [greeting, setGreeting] = useState<string>("Hey There!");

	// Check authentication and fetch greeting from backend on mount
    useEffect(() => {
        const initializeApp = async () => {
            // First, check if there's a token in the URL (for OAuth callback)
            const urlToken = extractTokenFromUrl();
            if (urlToken) {
                storeAuthToken(urlToken);
                // Clear the URL hash after extracting the token
                window.history.replaceState({}, document.title, window.location.pathname);
                // Reload the page to refresh user data in all components
                window.location.reload();
                return;
            }

            // Check if user is authenticated
            if (!isAuthenticated()) {
                router.push('/login');
                return;
            }
            
            let token: string | null = null;
            try {
                token = localStorage.getItem("access_token") ?? localStorage.getItem("token");
            } catch {}
            try {
                const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
                const res = await fetch(`${apiBase}/greeting`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: new URLSearchParams({
                        timestamp: new Date().toISOString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        localTime: new Date().toLocaleString(),
                    }),
                });
                if (!res.ok) return;
                const data = await res.json().catch(() => ({}));
                if (data && data.message) {
                   setGreeting(String(data.message));
                }
            } catch {}
        };
        initializeApp();
    }, [router]);

	// Animate steps
	useEffect(() => {
		if (isThinking) {
			const reasoningSteps = [
				"Analyzed your calendar for today",
				"Prioritized 3 urgent emails",
				"Suggested optimal meeting time",
				"Processing daily brief...",
			];
			let index = 0;
			const interval = setInterval(() => {
				if (index < reasoningSteps.length) {
					setSteps((prev) => [...prev, reasoningSteps[index]]);
					index++;
				} else clearInterval(interval);
			}, 1000);
			return () => clearInterval(interval);
		} else setSteps([]);
	}, [isThinking]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;
		setIsThinking(true);
		setInput("");
	};

	const handleExample = (text: string) => {
		setInput(text);
		setIsThinking(true);
	};
	function MobileProfileMenu() {
		const [open, setOpen] = useState(false);
		const router = useRouter();

		// Close when clicking outside
		useEffect(() => {
			const handleClickOutside = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				if (!target.closest(".mobile-profile-menu")) setOpen(false);
			};
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}, []);

		const handleLogout = () => {
			localStorage.removeItem("token");
			router.push("/login");
		};

		return (
			<div className="relative mobile-profile-menu flex flex-col items-center">
				{/* Profile Icon */}
				<button
					onClick={() => setOpen(!open)}
					className={`flex items-center justify-center w-11 h-11 rounded-lg border border-gray-100 shadow-sm bg-white transition-all ${
						open ? "bg-gray-100" : "hover:shadow-md"
					}`}
				>
					<Icon name="Profile" size={22} />
				</button>
				{/* Popup */}
				{open && (
					<div
						className="absolute bottom-[70px] right-[-60px] w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 animate-fadeIn z-50"
						style={{ transform: "translateX(-20%)" }}
					>
						<div className="px-4 pb-2 border-b border-gray-200">
							<div className="flex flex-col gap-0.5 text-gray-700 text-sm">
								<div className="flex items-center gap-2">
									<Image
										src="/Icons/Property 1=Profile.svg"
										alt="User"
										width={16}
										height={16}
										className="opacity-80"
									/>
									<span>miraisthbest@gmail.com</span>
								</div>
								<span className="pl-6 text-gray-500 text-xs">User NameF</span>
							</div>
						</div>

						<button
							onClick={() => alert("Switch account coming soon!")}
							className="flex items-center gap-3 w-full px-4 py-2 text-sm rounded-md hover:bg-[#f7f4fb] transition text-gray-700"
						>
							<Icon name="SwitchAccount" size={18} />
							Switch account
						</button>

						<hr className="my-1 border-gray-200" />

						<button
							onClick={handleLogout}
							className="flex items-center gap-3 w-full px-4 py-2 text-sm text-grey-600 hover:bg-grey-50 rounded-md transition"
						>
							<Icon name="Logout" size={18} />
							Log out
						</button>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col md:flex-row h-screen bg-[#F8F8FB] text-gray-800 overflow-hidden">
			{/* Main Section */}
			<main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 md:px-10 relative overflow-y-auto pb-20 md:pb-0">
				{/* Top icons */}
				<div className="absolute top-4 sm:top-6 md:top-8 right-6 sm:right-10">
					<div className="p-3 rounded-full bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer">
						<Icon name="VoiceOn" size={20} />
					</div>
				</div>

				{/* Weather indicator */}
				<div className="absolute top-4 sm:top-6 md:top-8 left-6 sm:left-10 flex items-center gap-2">
					<Icon name="Sun" size={20} className="text-yellow-500" />
					<span className="text-gray-600 text-sm font-medium">78°</span>
				</div>

				{/* Orb + Greeting */}
				<div className="relative mb-10 sm:mb-12 flex flex-col items-center">
					<div className="relative w-32 sm:w-40 md:w-48 h-32 sm:h-40 md:h-48 rounded-full bg-gradient-to-br from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5] shadow-[0_0_80px_15px_rgba(210,180,255,0.45)] animate-pulse"></div>
					<div className="absolute top-[15%] right-[-100px] sm:right-[-130px] md:right-[-150px] bg-white/90 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full shadow-[0_4px_25px_rgba(200,150,255,0.45)] text-gray-800 font-medium text-sm sm:text-[15px] leading-tight whitespace-nowrap backdrop-blur-sm border border-white/40">
						<span className="opacity-70">{greeting}</span>
					</div>
				</div>

				{/* Input Section */}
				<form
					onSubmit={handleSubmit}
					className="relative w-full max-w-md sm:max-w-2xl md:max-w-3xl flex flex-col items-center"
				>
					<div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#f4aaff] via-[#d9b8ff] to-[#bfa3ff] opacity-95 blur-[1.5px] shadow-[0_0_25px_ rgba(200,150,255,0.35)]"></div>
					<div className="relative flex items-center rounded-xl bg-white px-4 sm:px-5 py-2 sm:py-2.5 w-full">
						<input
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Ask anything..."
							className="flex-1 px-3 sm:px-6 py-2.5 bg-transparent text-gray-700 placeholder-gray-400 rounded-l-xl focus:outline-none font-medium text-sm sm:text-base"
						/>
						<button
							type="submit"
							className="flex items-center justify-center w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition"
						>
							<Icon name="Send" size={18} />
						</button>
					</div>
				</form>

				{/* Reasoning or Examples */}
				{!isThinking ? (
					<div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl mt-8 text-left px-1 sm:px-0">
						<h3 className="text-gray-800 font-medium mb-4 text-[15px] sm:text-[17px]">
							Get started with an example below
						</h3>

						<div className="flex flex-wrap gap-3 sm:gap-4">
							{[
								"Give me my daily brief",
								"Organize my calendar for today",
								"Send an email to customers",
							].map((example, i) => (
								<button
									key={i}
									onClick={() => handleExample(example)}
									className="px-4 sm:px-6 py-2 bg-white text-gray-800 font-medium rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition text-sm sm:text-base"
								>
									{example}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="w-full max-w-md sm:max-w-2xl md:max-w-3xl mt-8 text-left px-1 sm:px-0">
						<div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-6">
							<h4 className="font-semibold text-gray-800 mb-4 sm:mb-5 flex items-center gap-2 text-sm sm:text-base">
								<div className="w-3 h-3 rounded-full bg-[#7C5BFF] animate-pulse"></div>
								Mira’s Reasoning…
							</h4>

							<ul className="space-y-3 pl-4 sm:pl-6 border-l-[3px] border-[#7C5BFF]">
								{steps.map((step, i) => {
									const isLast = i === steps.length - 1;
									return (
										<li
											key={i}
											className="flex items-start gap-3 text-[13px] sm:text-[15px] font-medium text-gray-700"
										>
											<div
												className={`flex-shrink-0 mt-[2px] w-5 h-5 rounded-full flex items-center justify-center ${
													isLast
														? "border border-gray-300 text-gray-400"
														: "bg-[#7C5BFF]/10 border border-[#7C5BFF] text-[#7C5BFF]"
												}`}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													className={`w-3.5 h-3.5 ${
														isLast ? "opacity-50" : "opacity-100"
													}`}
												>
													<polyline points="20 6 9 17 4 12" />
												</svg>
											</div>
											<span
												className={`leading-tight ${
													isLast ? "text-gray-400 italic" : "text-gray-800"
												}`}
											>
												{step}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					</div>
				)}
			</main>

			{/* Bottom Nav (Mobile only) */}

			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around items-center py-3 z-50">
				{["Dashboard", "Settings", "Reminder"].map((name, i) => (
					<button
						key={i}
						onClick={() => {
							if (name === "Dashboard") router.push("/dashboard");
							else router.push(`/dashboard/${name.toLowerCase()}`);
						}}
						className="flex items-center justify-center w-11 h-11 rounded-xl bg-white shadow-sm hover:bg-gray-100 transition-all active:bg-gray-200"
					>
						<Icon name={name} size={22} className="text-gray-700" />
					</button>
				))}

				{/* ✅ Profile icon with same style */}
				<MobileProfileMenu />
			</div>
		</div>
	);
}
