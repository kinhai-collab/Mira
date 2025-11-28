/** @format */
"use client";

import Image from "next/image";
import Link from "next/link";

import StarFlowBackground from "@/components/landing/StarFlowBackground";

export default function LandingPage() {
	return (
		<div
			className="relative w-full min-h-screen flex flex-col items-center px-3 sm:px-4 md:px-6 lg:px-10 py-4 sm:py-6 md:py-10 lg:py-20 overflow-hidden"
			style={{
				background: "linear-gradient(180deg, #D0C7FA 0%, #FBDBED 100%)",
			}}
		>
			{/* ===================== LEFT ORB - Mobile Only ===================== */}
			<div
				className="md:hidden absolute left-[26px] top-[24px] w-[40px] h-[40px] rounded-full z-50"
				style={{
					background: "linear-gradient(135deg, #E1B5FF 0%, #C4A0FF 100%)",
					boxShadow: "0px 0px 10px 0px #BAB2DA",
					opacity: 1,
				}}
			/>

			{/* ===================== HEADER ===================== */}
			<div className="relative z-20 flex flex-col items-center text-center mt-4 sm:mt-6 md:mt-10 lg:mt-20 max-w-4xl mx-auto px-2 sm:px-4">
				{/* Row 1: Welcome to Mira */}
				<h1 className="flex flex-col md:flex-row items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-3 font-['Outfit'] font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-[60px] leading-tight text-[#282829]">
					<span>Welcome to</span>
					<span className="bg-gradient-to-b from-[#6A49ED] to-[#C83C8E] bg-clip-text text-transparent">
						Mira
					</span>
				</h1>

				{/* Row 2: Your Proactive... */}
				<p className="mt-2 sm:mt-3 md:mt-4 font-['Outfit'] font-medium text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl 3xl:text-[40px] leading-tight text-[#282829] px-2">
					Your Proactive Personal Assistant that
				</p>

				{/* Row 3: gives you time back... */}
				<p className="mt-1 sm:mt-1.5 md:mt-2 font-['Outfit'] font-medium text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl 3xl:text-[40px] leading-tight px-2">
					<span className="bg-gradient-to-b from-[#6A49ED] to-[#C83C8E] bg-clip-text text-transparent">
						gives you time back
					</span>{" "}
					<span className="text-[#282829]">to do things you love.</span>
				</p>
			</div>

			{/* ===================== RADIAL GRADIENT (Behind Box) ===================== */}
			<div
				className="absolute w-[150%] h-[150%] left-[-25%] top-[50%] pointer-events-none z-5 opacity-100 backdrop-blur-[20px]"
				style={{
					background:
						"radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%)",
					transform: "rotate(-30.81deg)",
				}}
			/>

			{/* ===================== MAIN CONTENT ===================== */}
			<div className="relative w-full mt-6 sm:mt-8 md:mt-12 lg:mt-20 flex flex-col lg:flex-row lg:justify-between lg:items-start max-w-7xl mx-auto px-2 sm:px-4">
				{/* ===================== LEFT SIDE (3D BOX) ===================== */}
				<div className="relative w-full lg:w-1/2 flex justify-center lg:justify-start mb-6 sm:mb-8 md:mb-10 lg:mb-0">
					{/* Scale wrapper for mobile responsiveness of the fixed-size box */}
					{/* We use a fixed size box (420px) and scale it down for mobile to preserve the 3D composition */}
					<div className="relative scale-[0.5] xs:scale-[0.6] sm:scale-[0.7] md:scale-[0.8] lg:scale-100 origin-top lg:origin-top-left">
						{/* ==== BIG STAR CLOUD ABOVE THE BOX ==== */}
						<div className="stars-mask absolute w-[400px] h-[350px] sm:w-[500px] sm:h-[450px] md:w-[600px] md:h-[550px] -top-12 sm:-top-16 md:-top-20 left-[-60px] sm:left-[-75px] md:left-[-90px] lg:left-20 opacity-100 z-12 pointer-events-none">
							<Image
								src="/Icons/LandingIcons/Vector 6.png"
								alt="stars"
								fill
								className="object-contain brightness-[1.3] contrast-[1.1]"
							/>
						</div>

						{/* ==== ARROWS ==== */}
						<Image
							src="/Icons/LandingIcons/Arrow 7.png"
							alt="left arrow up"
							width={50}
							height={50}
							className="absolute left-[85%] sm:left-[88%] md:left-[90%] top-[25%] z-[25] block w-[40px] h-[40px] sm:w-[55px] sm:h-[55px] md:w-[70px] md:h-[70px]"
						/>
						<Image
							src="/Icons/LandingIcons/Arrow 6.png"
							alt="right arrow down"
							width={40}
							height={40}
							className="absolute right-[70%] sm:right-[72%] md:right-[75%] top-[22%] z-[25] block w-[35px] h-[35px] sm:w-[45px] sm:h-[45px] md:w-[50px] md:h-[50px]"
						/>

						{/* ===================== BOX + FLOATING ICONS ===================== */}
						{/* FIXED SIZE CONTAINER to prevent shattering of absolute positioned elements */}
						<div className="relative w-[420px] h-[520px] mx-auto md:mx-0 z-[20]">
							{/* BACK WALLS */}
							<Image
								src="/Icons/LandingIcons/Polygon 8.png"
								alt=""
								width={160}
								height={230}
								className="absolute bottom-[33%] left-[16%]"
							/>
							<Image
								src="/Icons/LandingIcons/Polygon 9.png"
								alt=""
								width={160}
								height={230}
								className="absolute top-[14%] right-[8%]"
							/>

							{/* INNER GLOW */}
							<Image
								src="/Icons/LandingIcons/Ellipse 2.png"
								alt=""
								width={200}
								height={200}
								className="absolute right-[14%] top-[30%] z-[8]"
							/>

							{/* FRONT WALLS */}
							<Image
								src="/Icons/LandingIcons/Polygon 5.png"
								alt=""
								width={160}
								height={230}
								className="absolute top-[32%] left-[16%] z-[12]"
							/>
							<Image
								src="/Icons/LandingIcons/Polygon 6.png"
								alt=""
								width={160}
								height={230}
								className="absolute top-[32%] right-[8%] z-[12]"
							/>

							{/* LID */}
							<Image
								src="/Icons/LandingIcons/Polygon 7.png"
								alt=""
								width={260}
								height={200}
								className="absolute top-[12%] left-[30%] z-[20]"
							/>

							{/* FLOAT ICONS */}
							<Image
								src="/Icons/LandingIcons/Frame 1337.png"
								width={55}
								height={55}
								className="absolute left-[0%] top-[28%] animate-float-slow z-[30]"
								alt="search"
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1331.png"
								width={55}
								height={55}
								className="absolute left-[20%] top-[30%] animate-float z-[30]"
								alt="Gmail"
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1332.png"
								width={55}
								height={55}
								className="absolute left-[30%] top-[30%] animate-float-slow z-[30]"
								alt="Notes"
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1339.png"
								width={60}
								height={60}
								className="absolute right-[-22%] top-[10%] animate-float z-[30]"
								alt=""
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1336.png"
								width={60}
								height={60}
								className="absolute right-[10%] top-[10%] animate-float z-[30]"
								alt="Camera"
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1338.png"
								width={60}
								height={60}
								className="absolute right-[-10%] top-[28%] animate-float-slow z-[30]"
								alt=""
							/>

							{/* INSIDE ICONS */}
							<Image
								src="/Icons/LandingIcons/Frame 1330.png"
								width={55}
								height={55}
								className="absolute left-[32%] top-[25%] z-[7] animate-float-slow"
								alt="outlook"
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1328.png"
								width={55}
								height={55}
								className="absolute left-[40%] top-[35%] z-[8] animate-float"
								alt="teams"
							/>
							<Image
								src="/Icons/LandingIcons/Frame 1329.png"
								width={55}
								height={55}
								className="absolute top-[20%] left-[20%] z-[8] animate-float"
								alt=""
							/>
						</div>
					</div>
				</div>

				{/* ===================== RIGHT SIDE (BUILT FOR) ===================== */}
				<div className="relative z-[20] w-full lg:w-1/2 lg:pl-6 xl:pl-10 mt-3 sm:mt-4 md:mt-6 lg:mt-0">
					<div className="text-center w-full max-w-lg mx-auto lg:mx-0 lg:text-left">
						<h2 className="text-[10px] sm:text-xs md:text-sm font-light text-[#5A4765] uppercase tracking-wider">
							Built For
						</h2>
						<h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-normal mt-1 sm:mt-1.5 md:mt-2 text-[#1A1A1A]">
							Whom Mira Helps Every Day
						</h3>
					</div>

					{/* ===================== CARDS ===================== */}
					<div className="mt-3 sm:mt-4 md:mt-6 grid gap-2.5 sm:gap-3 md:gap-4 w-full max-w-lg mx-auto lg:mx-0">
						<div className="p-2.5 sm:p-3 md:p-4 bg-[#EFEBFF] rounded-lg sm:rounded-xl md:rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-xs sm:text-sm md:text-base text-[#1A1A1A] flex items-center gap-1.5 sm:gap-2">
								<span className="text-[#464647] text-lg sm:text-xl md:text-2xl leading-none">•</span>
								Busy Professionals
							</p>
							<p className="text-[11px] sm:text-xs md:text-sm text-gray-700 mt-0.5 sm:mt-1 leading-relaxed">
								Streamline your workflow and reclaim hours with intelligent
								automation.
							</p>
						</div>

						<div className="p-2.5 sm:p-3 md:p-4 bg-[#EFEBFF] rounded-lg sm:rounded-xl md:rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-xs sm:text-sm md:text-base text-[#1A1A1A] flex items-center gap-1.5 sm:gap-2">
								<span className="text-[#464647] text-lg sm:text-xl md:text-2xl leading-none">•</span>
								Young Parents
							</p>
							<p className="text-[11px] sm:text-xs md:text-sm text-gray-700 mt-0.5 sm:mt-1 leading-relaxed">
								Balance family life and personal goals effortlessly with
								reminders.
							</p>
						</div>

						<div className="p-2.5 sm:p-3 md:p-4 bg-[#EFEBFF] rounded-lg sm:rounded-xl md:rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-xs sm:text-sm md:text-base text-[#1A1A1A] flex items-center gap-1.5 sm:gap-2">
								<span className="text-[#464647] text-lg sm:text-xl md:text-2xl leading-none">•</span>
								Ambitious Young Adults
							</p>
							<p className="text-[11px] sm:text-xs md:text-sm text-gray-700 mt-0.5 sm:mt-1 leading-relaxed">
								Stay on track with insights and productivity boosters.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* ===================== ANIMATIONS + MASK ===================== */}
			<style>{`
				@keyframes float {
					0% { transform: translateY(0px); }
					50% { transform: translateY(-10px); }
					100% { transform: translateY(0px); }
				}
				.animate-float { animation: float 4s ease-in-out infinite; }

				@keyframes floatSlow {
					0% { transform: translateY(0px); }
					50% { transform: translateY(-6px); }
					100% { transform: translateY(0px); }
				}
				.animate-float-slow { animation: floatSlow 6s ease-in-out infinite; }

				.stars-mask {
					-webkit-mask-image: radial-gradient(circle, rgba(0,0,0,1) 42%, rgba(0,0,0,0) 82%);
					mask-image: radial-gradient(circle, rgba(0,0,0,1) 42%, rgba(0,0,0,0) 82%);
				}

				.shadow-card {
					box-shadow: 0px 4px 8px rgba(0,0,0,0.16);
				}
			`}</style>

			<div className="mt-4 sm:mt-6 md:mt-8 flex justify-center relative z-[50] px-3 sm:px-4">
				<Link href="/login" className="w-full sm:w-auto">
					<button
						className="bg-black text-white py-2 sm:py-2.5 md:py-3 px-5 sm:px-6 md:px-8 lg:px-10 rounded-full text-sm sm:text-base md:text-lg font-medium shadow-lg
                       transition-all duration-300 ease-out w-full sm:w-auto
                       hover:opacity-90 hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:-translate-y-1"
					>
						Get Started
					</button>
				</Link>
			</div>

			{/* ===================== SECTION 2 (FEATURES) ===================== */}
			<div className="relative w-full mt-8 sm:mt-12 md:mt-16 lg:mt-20 xl:mt-24 px-3 sm:px-4 md:px-6 lg:px-10 z-[10] flex justify-center pb-8 sm:pb-12 md:pb-16 lg:pb-20">
				{/* STAR FLOW BACKGROUND */}
				{/* Fixed: Changed bottom-[-20%] to bottom-0 to prevent huge empty space at the bottom */}
				<div className="absolute bottom-0 left-0 w-full h-full z-[0] pointer-events-none overflow-hidden flex justify-center items-end">
					<div className="w-full max-w-[1690px] h-[400px] sm:h-[600px] md:h-[800px] lg:h-[1014px] relative opacity-60">
						<StarFlowBackground />
					</div>
				</div>

				<div className="flex flex-col gap-8 sm:gap-12 md:gap-16 lg:gap-20 xl:gap-32 w-full max-w-6xl relative z-20">
					{/* ===================== ROW 1 ===================== */}
					<div className="flex flex-col-reverse md:flex-row items-center gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-20">
						{/* LEFT: Text Content */}
						<div className="flex flex-col gap-3 sm:gap-4 md:gap-6 lg:gap-8 w-full md:w-1/2">
							{[
								"Simplifies Life with an Intelligent Assistance",
								"Context Awareness and Personalization",
								"Data Privacy and Ethical Automation",
							].map((text, i) => (
								<div key={i} className="flex items-start sm:items-center gap-2 sm:gap-3">
									<div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 flex items-center justify-center flex-none mt-0.5 sm:mt-0">
										<div className="w-4 h-[12px] sm:w-5 sm:h-[14px] md:w-5 md:h-[16px] lg:w-6 lg:h-[18px] bg-[#282829] [mask-image:url('/Icons/Property_1=Done.svg')] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]" />
									</div>
									<span className="font-['Outfit'] font-medium text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-[#282829] leading-relaxed">
										{text}
									</span>
								</div>
							))}
						</div>

						{/* RIGHT: Image */}
						<div
							className="w-full md:w-1/2 h-[180px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[320px] bg-cover bg-center rounded-lg sm:rounded-xl shadow-lg"
							style={{
								backgroundImage:
									"url('/Icons/LandingIcons/Home_ Add_New_Event.png')",
							}}
						/>
					</div>

					{/* ===================== ROW 2 ===================== */}
					<div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-20">
						{/* LEFT: Image */}
						<div
							className="w-full md:w-1/2 h-[180px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[320px] bg-cover bg-center rounded-lg sm:rounded-xl shadow-lg order-1 md:order-1"
							style={{
								backgroundImage: "url('/Icons/LandingIcons/Home_ Trigger.png')",
							}}
						/>

						{/* RIGHT: Content */}
						<div className="flex flex-col gap-4 sm:gap-6 md:gap-8 lg:gap-10 w-full md:w-1/2 order-2 md:order-2">
							<div className="flex flex-col gap-3 sm:gap-4 md:gap-6 lg:gap-8">
								{[
									"Voice-First, Reliable, and Personable",
									"Powerful Productivity Features",
									"Empowers Work-Life Balance",
								].map((text, i) => (
									<div key={i} className="flex items-start sm:items-center gap-2 sm:gap-3">
										<div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 flex items-center justify-center flex-none mt-0.5 sm:mt-0">
											<div className="w-4 h-[12px] sm:w-5 sm:h-[14px] md:w-5 md:h-[16px] lg:w-6 lg:h-[18px] bg-[#282829] [mask-image:url('/Icons/Property_1=Done.svg')] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]" />
										</div>
										<span className="font-['Outfit'] font-medium text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-[#282829] leading-relaxed">
											{text}
										</span>
									</div>
								))}
							</div>

							{/* CTA BUTTON */}
							<button className="bg-[#282829] text-[#FBFCFD] py-2 sm:py-2.5 md:py-3 px-4 sm:px-5 md:px-6 rounded-full font-['Outfit'] font-medium text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl w-full sm:w-auto shadow-md hover:opacity-90 transition">
								Request Early Access
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
