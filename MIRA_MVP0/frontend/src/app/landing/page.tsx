/** @format */
"use client";

import Image from "next/image";
import Link from "next/link";

import StarFlowBackground from "@/components/landing/StarFlowBackground";

export default function LandingPage() {
	return (
		<div
			className="relative w-full min-h-screen flex flex-col items-center px-3 sm:px-4 md:px-6 lg:px-10 py-12 sm:py-16 md:py-20 overflow-hidden"
			style={{
				background: "linear-gradient(180deg, #D0C7FA 0%, #FBDBED 100%)",
			}}
		>


			{/* ===================== LEFT ORB ===================== */}
			<div
				className="absolute w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 left-3 sm:left-4 md:left-6 lg:left-[26px] top-3 sm:top-4 md:top-6 lg:top-[24px] rounded-full z-[50]"
				style={{
					background: "linear-gradient(135deg, #E1B5FF 0%, #C4A0FF 100%)",
					boxShadow: "0px 0px 10px 0px #BAB2DA",
				}}
			/>

			{/* ===================== HEADER ===================== */}
			<div className="relative w-full max-w-[745px] px-4 sm:px-6 md:px-8 mt-20 sm:mt-24 md:mt-32 lg:mt-[165px] flex flex-col items-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 z-[20]">
				{/* Row 1: Welcome to Mira */}
				<div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 md:gap-4 lg:gap-8">
					<span className="text-3xl sm:text-4xl md:text-5xl lg:text-[60px] font-semibold text-center leading-tight sm:leading-[1.2] md:leading-[1.25] lg:leading-[76px] tracking-[0.005em] text-[#282829] font-['Outfit']">
						Welcome to
					</span>
					<span
						className="text-3xl sm:text-4xl md:text-5xl lg:text-[60px] font-semibold text-center leading-tight sm:leading-[1.2] md:leading-[1.25] lg:leading-[76px] tracking-[0.005em] font-['Outfit']"
						style={{
							background: "linear-gradient(180deg, #6A49ED 0%, #C83C8E 100%)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
						}}
					>
						Mira
					</span>
				</div>

				{/* Row 2: Your Proactive... */}
				<div className="w-full text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-[40px] font-medium text-center leading-tight sm:leading-snug md:leading-[1.2] lg:leading-[50px] tracking-[0.005em] text-[#282829] font-['Outfit'] px-2">
					Your Proactive Personal Assistant that
				</div>

				{/* Row 3: gives you time back... */}
				<div className="w-full text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-[40px] font-medium text-center leading-tight sm:leading-snug md:leading-[1.2] lg:leading-[50px] tracking-[0.005em] font-['Outfit'] px-2">
					<span
						style={{
							background: "linear-gradient(180deg, #6A49ED 0%, #C83C8E 100%)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
						}}
					>
						gives you time back
					</span>{" "}
					<span className="text-[#282829]">to do things you love.</span>
				</div>
			</div>

			{/* ===================== RADIAL GRADIENT (Behind Box) ===================== */}
			<div
				className="absolute w-[600px] sm:w-[800px] md:w-[1000px] lg:w-[1051.72px] h-[400px] sm:h-[600px] md:h-[750px] lg:h-[799.22px] left-[-100px] sm:left-[-150px] md:left-[-72px] top-[600px] sm:top-[700px] md:top-[850px] lg:top-[959px] opacity-100 backdrop-blur-[20px] z-[5] pointer-events-none"
				style={{
					background:
						"radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%)",
					transform: "rotate(-30.81deg)",
				}}
			/>

			{/* ===================== MAIN CONTENT ===================== */}
			<div className="relative w-full mt-32 sm:mt-40 md:mt-[350px] lg:mt-[400px] flex flex-col md:flex-row md:justify-between md:items-start px-4 sm:px-6 md:px-8 lg:px-6">
				{/* ===================== LEFT SIDE ===================== */}
				<div className="relative w-full md:w-1/2 flex justify-center items-center md:justify-start">
					{/* ==== BIG STAR CLOUD ABOVE THE BOX ==== */}
					<div
						className="stars-mask absolute w-[300px] sm:w-[400px] md:w-[500px] lg:w-[600px] h-[275px] sm:h-[350px] md:h-[450px] lg:h-[550px] top-0 left-[50%] sm:left-[40%] md:left-[200px] translate-x-[-50%] md:translate-x-0 opacity-100 z-[12] hidden sm:block"
					>
						<Image
							src="/Icons/LandingIcons/Vector 6.png"
							alt="stars"
							fill
							className="object-contain brightness-[1.3] contrast-[1.1]"
						/>
					</div>

					{/* ==== LEFT ARROW (down curve) ==== */}
					<Image
						src="/Icons/LandingIcons/Arrow 7.png"
						alt="left arrow up"
						width={70}
						height={70}
						className="absolute w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-[70px] lg:h-[70px] left-[85%] sm:left-[90%] top-[20%] sm:top-[25%] z-[25] hidden sm:block"
					/>

					{/* ==== RIGHT ARROW (up curve) ==== */}
					<Image
						src="/Icons/LandingIcons/Arrow 6.png"
						alt="right arrow down"
						width={50}
						height={50}
						className="absolute w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[50px] lg:h-[50px] right-[70%] sm:right-[75%] top-[18%] sm:top-[22%] z-[25] hidden sm:block"
					/>

					{/* ===================== BOX + FLOATING ICONS ===================== */}
					<div className="relative w-[240px] h-[300px] sm:w-[300px] sm:h-[370px] md:w-[360px] md:h-[450px] lg:w-[420px] lg:h-[520px] mx-auto md:mx-0 md:left-[10%] lg:left-[20%] z-[20] flex items-center justify-center">
						{/* BACK WALLS */}
						<Image
							src="/Icons/LandingIcons/Polygon 8.png"
							alt=""
							width={160}
							height={230}
							className="absolute bottom-[33%] left-[16%] w-[90px] h-[130px] sm:w-[110px] sm:h-[160px] md:w-[130px] md:h-[190px] lg:w-[160px] lg:h-[230px] object-contain"
						/>
						<Image
							src="/Icons/LandingIcons/Polygon 9.png"
							alt=""
							width={160}
							height={230}
							className="absolute top-[14%] right-[8%] w-[90px] h-[130px] sm:w-[110px] sm:h-[160px] md:w-[130px] md:h-[190px] lg:w-[160px] lg:h-[230px] object-contain"
						/>

						{/* INNER GLOW */}
						<Image
							src="/Icons/LandingIcons/Ellipse 2.png"
							alt=""
							width={200}
							height={200}
							className="absolute right-[14%] top-[30%] z-[8] w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] md:w-[170px] md:h-[170px] lg:w-[200px] lg:h-[200px] object-contain"
						/>

						{/* FRONT WALLS */}
						<Image
							src="/Icons/LandingIcons/Polygon 5.png"
							alt=""
							width={160}
							height={230}
							className="absolute top-[32%] left-[16%] z-[12] w-[90px] h-[130px] sm:w-[110px] sm:h-[160px] md:w-[130px] md:h-[190px] lg:w-[160px] lg:h-[230px] object-contain"
						/>
						<Image
							src="/Icons/LandingIcons/Polygon 6.png"
							alt=""
							width={160}
							height={230}
							className="absolute top-[32%] right-[8%] z-[12] w-[90px] h-[130px] sm:w-[110px] sm:h-[160px] md:w-[130px] md:h-[190px] lg:w-[160px] lg:h-[230px] object-contain"
						/>

						{/* LID */}
						<Image
							src="/Icons/LandingIcons/Polygon 7.png"
							alt=""
							width={260}
							height={200}
							className="absolute top-[12%] left-[30%] z-[20] w-[150px] h-[115px] sm:w-[190px] sm:h-[145px] md:w-[230px] md:h-[175px] lg:w-[260px] lg:h-[200px] object-contain"
						/>

						{/* FLOAT ICONS */}
						<Image
							src="/Icons/LandingIcons/Frame 1337.png"
							width={55}
							height={55}
							className="absolute left-[0%] top-[28%] animate-float-slow z-[30] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[55px] lg:h-[55px] object-contain"
							alt="search"
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1331.png"
							width={55}
							height={55}
							className="absolute left-[20%] top-[30%] animate-float z-[30] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[55px] lg:h-[55px] object-contain"
							alt="Gmail"
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1332.png"
							width={55}
							height={55}
							className="absolute left-[30%] top-[30%] animate-float-slow z-[30] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[55px] lg:h-[55px] object-contain"
							alt="Notes"
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1339.png"
							width={60}
							height={60}
							className="absolute right-[-12%] sm:right-[-18%] md:right-[-22%] top-[10%] animate-float z-[30] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[60px] lg:h-[60px] object-contain"
							alt=""
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1336.png"
							width={60}
							height={60}
							className="absolute right-[8%] sm:right-[10%] top-[10%] animate-float z-[30] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[60px] lg:h-[60px] object-contain"
							alt="Camera"
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1338.png"
							width={60}
							height={60}
							className="absolute right-[-6%] sm:right-[-8%] md:right-[-10%] top-[28%] animate-float-slow z-[30] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[60px] lg:h-[60px] object-contain"
							alt=""
						/>

						{/* INSIDE ICONS */}
						<Image
							src="/Icons/LandingIcons/Frame 1330.png"
							width={55}
							height={55}
							className="absolute left-[32%] top-[25%] z-[7] animate-float-slow w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[55px] lg:h-[55px] object-contain"
							alt="outlook"
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1328.png"
							width={55}
							height={55}
							className="absolute left-[40%] top-[35%] z-[8] animate-float w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[55px] lg:h-[55px] object-contain"
							alt="teams"
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1329.png"
							width={55}
							height={55}
							className="absolute top-[20%] left-[20%] z-[8] animate-float w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-[55px] lg:h-[55px] object-contain"
							alt=""
						/>
					</div>
				</div>
				{/* ===================== RIGHT SIDE ===================== */}
				<div className="relative z-[20] mt-12 sm:mt-16 md:mt-0 md:w-1/2 md:pl-8 lg:pl-12 xl:pl-20">
					<div className="text-center w-full md:w-[90%] lg:w-[80%] xl:w-[70%] mx-auto">
						<h2 className="text-xs sm:text-sm font-light text-[#5A4765] uppercase tracking-wider">
							Built For
						</h2>
						<h3 className="text-2xl sm:text-3xl md:text-4xl font-normal mt-1 sm:mt-2 text-[#1A1A1A]">
							Whom Mira Helps Every Day
						</h3>
					</div>

					{/* ===================== CARDS ===================== */}
					<div className="mt-6 sm:mt-8 md:mt-10 grid gap-4 sm:gap-5 md:gap-6 w-full md:w-[90%] lg:w-[80%] xl:w-[70%] mx-auto">
						<div className="p-4 sm:p-5 md:p-6 bg-[#EFEBFF] rounded-xl sm:rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-sm sm:text-base md:text-lg text-[#1A1A1A] flex items-center gap-2">
								<span className="text-[#464647] text-xl sm:text-2xl leading-none">•</span>
								Busy Professionals
							</p>
							<p className="text-xs sm:text-sm md:text-base text-gray-700 mt-1 sm:mt-2">
								Streamline your workflow and reclaim hours with intelligent
								automation.
							</p>
						</div>

						<div className="p-4 sm:p-5 md:p-6 bg-[#EFEBFF] rounded-xl sm:rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-sm sm:text-base md:text-lg text-[#1A1A1A] flex items-center gap-2">
								<span className="text-[#464647] text-xl sm:text-2xl leading-none">•</span>
								Young Parents
							</p>
							<p className="text-xs sm:text-sm md:text-base text-gray-700 mt-1 sm:mt-2">
								Balance family life and personal goals effortlessly with
								reminders.
							</p>
						</div>

						<div className="p-4 sm:p-5 md:p-6 bg-[#EFEBFF] rounded-xl sm:rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-sm sm:text-base md:text-lg text-[#1A1A1A] flex items-center gap-2">
								<span className="text-[#464647] text-xl sm:text-2xl leading-none">•</span>
								Ambitious Young Adults
							</p>
							<p className="text-xs sm:text-sm md:text-base text-gray-700 mt-1 sm:mt-2">
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
			<div className="mt-8 sm:mt-10 md:mt-12 flex justify-center relative z-[50]">
				<Link href="/login">
					<button
						className="bg-black text-white py-2.5 sm:py-3 px-6 sm:px-8 md:px-10 rounded-full text-sm sm:text-base md:text-lg font-medium shadow-lg
                       transition-all duration-300 ease-out
                       hover:opacity-90 hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:-translate-y-1"
					>
						Get Started
					</button>
				</Link>
			</div>
			{/* ===================== SECTION 2 (FEATURES) ===================== */}
			<div className="relative w-full mt-16 sm:mt-24 md:mt-32 px-4 sm:px-6 md:px-12 lg:px-16 xl:px-24 z-[10] flex justify-center">
				{/* STAR FLOW BACKGROUND */}
				<div className="absolute bottom-[-20%] left-0 w-full h-full z-[0] pointer-events-none overflow-hidden flex justify-center items-end">
					<div className="w-full max-w-[1690px] h-[600px] sm:h-[800px] md:h-[1014px] relative opacity-60">
						<StarFlowBackground />
					</div>
				</div>

				<div className="flex flex-col items-start gap-12 sm:gap-16 md:gap-24 lg:gap-[200px] w-full max-w-[1126px] relative z-[20]">
					{/* ===================== ROW 1 (Frame 1357) ===================== */}
					<div className="flex flex-col md:flex-row items-center md:items-center gap-8 sm:gap-12 md:gap-16 lg:gap-[120px] w-full">
						{/* LEFT: Text Content (Frame 1343) */}
						<div className="flex flex-col justify-center items-start gap-6 sm:gap-8 md:gap-10 lg:gap-[40px] w-full md:w-[506px] flex-shrink-0 order-1 md:order-0">
							{[
								"Simplifies Life with an Intelligent Assistance",
								"Context Awareness and Personalization",
								"Data Privacy and Ethical Automation",
							].map((text, i) => (
								<div
									key={i}
									className="flex flex-row items-center gap-2 sm:gap-4 md:gap-6 lg:gap-2 w-full"
								>
									<div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-[30px] lg:h-[30px] flex-shrink-0 flex items-center justify-center">
										{/* Vector Icon */}
										<div
											className="w-4 h-3 sm:w-5 sm:h-4 md:w-6 md:h-4 lg:w-[24px] lg:h-[18px] bg-[#282829]"
											style={{
												maskImage: "url('/Icons/Property 1=Done.svg')",
												WebkitMaskImage: "url('/Icons/Property 1=Done.svg')",
												maskSize: "contain",
												WebkitMaskSize: "contain",
												maskRepeat: "no-repeat",
												WebkitMaskRepeat: "no-repeat",
												maskPosition: "center",
												WebkitMaskPosition: "center",
											}}
										/>
									</div>
									<span className="font-['Outfit'] font-medium text-sm sm:text-base md:text-lg lg:text-xl xl:text-[24px] leading-tight sm:leading-snug md:leading-normal lg:leading-[30px] tracking-[0.005em] text-[#282829] flex-1">
										{text}
									</span>
								</div>
							))}
						</div>

						{/* RIGHT: Image (Rectangle) */}
						<div
							className="w-full max-w-[500px] h-[200px] sm:h-[250px] md:h-[280px] lg:h-[316px] bg-cover bg-center rounded-lg sm:rounded-xl lg:rounded-[12px] flex-shrink-0 order-0 md:order-1 drop-shadow-[0px_4px_24px_rgba(0,0,0,0.2)]"
							style={{
								backgroundImage: "url('/Icons/LandingIcons/Home_ Add_New_Event.png')",
							}}
						/>
					</div>

					{/* ===================== ROW 2 (Frame 1358) ===================== */}
					<div className="flex flex-col md:flex-row items-center md:items-center gap-8 sm:gap-12 md:gap-16 lg:gap-[120px] w-full">
						{/* LEFT: Image (Rectangle) */}
						<div
							className="w-full max-w-[500px] h-[200px] sm:h-[250px] md:h-[280px] lg:h-[316px] bg-cover bg-center rounded-lg sm:rounded-xl lg:rounded-[12px] flex-shrink-0 order-0 drop-shadow-[0px_4px_24px_rgba(0,0,0,0.2)]"
							style={{
								backgroundImage: "url('/Icons/LandingIcons/Home_ Trigger.png')",
							}}
						/>

						{/* RIGHT: Content (Frame 1356) */}
						<div className="flex flex-col items-start gap-8 sm:gap-10 md:gap-12 lg:gap-[56px] w-full md:w-[506px] flex-shrink-0 order-1">
							{/* Text List (Frame 1344) */}
							<div className="flex flex-col items-start gap-6 sm:gap-8 md:gap-10 lg:gap-[40px] w-full">
								{[
									"Voice-First, Reliable, and Personable",
									"Powerful Productivity Features",
									"Empowers Work-Life Balance",
								].map((text, i) => (
									<div
										key={i}
										className="flex flex-row items-center gap-1 sm:gap-2 md:gap-3 lg:gap-1 w-full"
									>
										<div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-[30px] lg:h-[30px] flex-shrink-0 flex items-center justify-center">
											{/* Vector Icon */}
											<div
												className="w-4 h-3 sm:w-5 sm:h-4 md:w-6 md:h-4 lg:w-[24px] lg:h-[18px] bg-[#282829]"
												style={{
													maskImage: "url('/Icons/Property 1=Done.svg')",
													WebkitMaskImage: "url('/Icons/Property 1=Done.svg')",
													maskSize: "contain",
													WebkitMaskSize: "contain",
													maskRepeat: "no-repeat",
													WebkitMaskRepeat: "no-repeat",
													maskPosition: "center",
													WebkitMaskPosition: "center",
												}}
											/>
										</div>
										<span className="font-['Outfit'] font-medium text-sm sm:text-base md:text-lg lg:text-xl xl:text-[24px] leading-tight sm:leading-snug md:leading-normal lg:leading-[30px] tracking-[0.005em] text-[#282829] flex-1">
											{text}
										</span>
									</div>
								))}
							</div>

							{/* CTA BUTTON (Frame 998 + Frame 983) */}
							<div className="flex flex-col items-start gap-3 sm:gap-4 md:gap-[12px] w-full">
								<button
									className="flex flex-row justify-center items-center py-2.5 sm:py-3 md:py-[12px] px-4 sm:px-6 md:px-[24px] w-full h-[44px] sm:h-[48px] md:h-[54px] bg-[#282829] rounded-full sm:rounded-[50px] border-none cursor-pointer transition-all hover:opacity-90 hover:shadow-lg"
								>
									<span className="font-['Outfit'] font-medium text-base sm:text-lg md:text-xl lg:text-[24px] leading-tight sm:leading-snug md:leading-[30px] tracking-[0.005em] text-[#FBFCFD]">
										Request Early Access
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
