/** @format */
import { Icon } from "@/components/Icon";

export default function Home() {
	return (
		<div className="flex h-screen bg-[#F8F8FB] text-gray-800">
			{/* Slim Sidebar */}
			<aside className="w-20 bg-[#F0ECF8] flex flex-col items-center justify-between py-6 border-r border-gray-200">
				{/* Top Section */}
				<div className="flex flex-col items-center space-y-6">
					{/* Mira orb */}
					<div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400" />

					{/* Icon buttons */}
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
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
			</aside>

			{/* Main Section */}
			<main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
				{/* Top right sound icon */}
				<div className="absolute top-8 right-10">
					<div className="p-3 rounded-full bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer">
						<Icon
							name="VoiceOn"
							size={20}
							className="opacity-80 hover:opacity-100 transition"
						/>
					</div>
				</div>

				{/* Weather indicator */}
				<div className="absolute top-8 left-28 flex items-center gap-2">
					<Icon name="Sun" size={22} className="text-yellow-500" />
					<span className="text-gray-600 text-sm font-medium">78°</span>
				</div>

				{/* Greeting bubble */}
				<div className="relative mb-12 flex flex-col items-center">
					{/* Gradient orb with gentle glow */}
					<div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5] shadow-[0_0_80px_15px_rgba(210,180,255,0.45)]"></div>

					{/* Floating greeting bubble slightly outside orb */}
					<div className="absolute top-[15%] right-[-150px] bg-white/90 px-6 py-2 rounded-full shadow-[0_4px_25px_rgba(200,150,255,0.45)] text-gray-800 font-medium text-[15px] leading-tight whitespace-nowrap backdrop-blur-sm border border-white/40">
						<span className="drop-shadow-[0_0_6px_rgba(200,150,255,0.6)]">
							Good Morning, Bob!
						</span>
					</div>
				</div>

				{/* Search / Input section */}
				<div className="relative w-full max-w-3xl">
					{/* Outer gradient border + glow */}
					<div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#f4aaff] via-[#d9b8ff] to-[#bfa3ff] opacity-95 blur-[1.5px] shadow-[0_0_25px_rgba(200,150,255,0.35)]"></div>

					{/* Inner container */}
					<div className="relative flex items-center rounded-xl bg-white px-5 py-2.5">
						<input
							type="text"
							placeholder="Ask anything..."
							className="flex-1 px-6 py-2.5 bg-transparent text-gray-700 placeholder-gray-400 rounded-l-xl focus:outline-none font-medium"
						/>
						<button className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition">
							<Icon name="Send" size={18} className="text-gray-700" />
						</button>
					</div>
				</div>

				{/* Example section */}
				<div className="w-full max-w-3xl mt-8 text-left">
					<h3 className="text-gray-800 font-medium mb-4 text-[17px]">
						Get started with an example below
					</h3>

					<div className="flex justify-start gap-4 flex-nowrap">
						<button className="px-6 py-2 bg-white text-gray-800 font-medium rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition whitespace-nowrap">
							Give me my daily brief
						</button>
						<button className="px-6 py-2 bg-white text-gray-800 font-medium rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition whitespace-nowrap">
							Organize my calendar for today
						</button>
						<button className="px-6 py-2 bg-white text-gray-800 font-medium rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition whitespace-nowrap">
							Send an email to customers
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
