/** @format */
"use client";

import Image from "next/image";

export default function LandingPage() {
	return (
		<div className="relative w-full min-h-screen bg-[#D7C3F2] flex flex-col items-center px-4 md:px-10 py-20 overflow-hidden">
			{/* ==== LEFT GRADIENT ==== */}
			<Image
				src="/Icons/LandingIcons/Ellipse 17.png"
				alt="left glow"
				width={1500}
				height={1500}
				className="absolute top-[-20%] left-[-5%] opacity-[0.92] z-[1]"
			/>

			{/* ==== RIGHT GRADIENT ==== */}
			<Image
				src="/Icons/LandingIcons/Ellipse 21.png"
				alt="right glow"
				width={900}
				height={900}
				className="absolute top-[-10%] right-[-10%] opacity-[0.95] z-[1]"
			/>

			{/* ===================== HEADER ===================== */}
			<div className="text-center max-w-3xl relative z-[20]">
				<h1 className="text-4xl md:text-5xl font-bold text-[#392B4C]">
					Welcome to <span className="text-[#7E3FF2]">Mira</span>
				</h1>

				<p className="text-lg md:text-xl text-gray-700 mt-4">
					Your Proactive Personal Assistant that{" "}
					<span className="font-semibold text-[#8D44C2]">
						gives you time back
					</span>{" "}
					to do things you love.
				</p>
			</div>

			{/* ===================== MAIN CONTENT ===================== */}
			<div className="relative w-full mt-20 flex flex-col md:flex-row md:justify-between md:items-start px-6">
				{/* ===================== LEFT SIDE ===================== */}
				<div className="relative w-full md:w-1/2 flex justify-center md:justify-start">
					{/* ==== BIG STAR CLOUD ABOVE THE BOX ==== */}
					<div className="absolute top-[-40%] left-[30%] w-[600px] h-[600px] stars-mask z-[12] rotate-[20deg]">
						<Image
							src="/Icons/LandingIcons/Vector 6.png"
							alt="stars"
							fill
							className="object-contain opacity-[0.98] brightness-[1.3] contrast-[1.1]"
						/>
					</div>

					{/* ==== LEFT ARROW (down curve) ==== */}
					<Image
						src="/Icons/LandingIcons/Arrow 7.png"
						alt="left arrow up"
						width={70}
						height={70}
						className="absolute left-[80%] top-[25%] z-[25]"
					/>

					{/* ==== RIGHT ARROW (up curve) ==== */}
					<Image
						src="/Icons/LandingIcons/Arrow 6.png"
						alt="right arrow down"
						width={50}
						height={50}
						className="absolute right-[84%] top-[22%] z-[25]"
					/>

					{/* ===================== BOX + FLOATING ICONS ===================== */}
					<div className="relative w-[340px] h-[420px] md:w-[420px] md:h-[520px] left-[20%] z-[20]">
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
							className="absolute left-[-10%] top-[28%] animate-float-slow z-[30]"
							alt="clock"
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
							className="absolute right-[-22%] top-[100%] animate-float z-[30]"
							alt=""
						/>

						<Image
							src="/Icons/LandingIcons/Frame 1336.png"
							width={60}
							height={60}
							className="absolute right-[10%] top-[10%] animate-float z-[30]"
							alt=""
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

				{/* ===================== RIGHT SIDE ===================== */}
				<div className="relative z-[20] mt-16 md:mt-0 md:w-1/2 md:pl-20">
					<div className="text-center w-full md:w-[80%] lg:w-[70%] mx-auto">
						<h2 className="text-sm font-light text-[#5A4765] uppercase tracking-wider">
							Built For
						</h2>
						<h3 className="text-4xl font-normal mt-2 text-[#1A1A1A]">
							Whom Mira Helps Every Day
						</h3>
					</div>

					{/* ===================== CARDS ===================== */}
					<div className="mt-10 grid gap-6 w-full md:w-[80%] lg:w-[70%] mx-auto">
						<div className="p-6 bg-[#EFEBFF] rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-[#1A1A1A] flex items-center gap-2">
								<span className="text-[#464647] text-2xl leading-none">•</span>
								Busy Professionals
							</p>
							<p className="text-base text-gray-700 mt-2">
								Streamline your workflow and reclaim hours with intelligent
								automation.
							</p>
						</div>

						<div className="p-6 bg-[#EFEBFF] rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-[#1A1A1A] flex items-center gap-2">
								<span className="text-[#464647] text-2xl leading-none">•</span>
								Young Parents
							</p>
							<p className="text-base text-gray-700 mt-2">
								Balance family life and personal goals effortlessly with
								reminders.
							</p>
						</div>

						<div className="p-6 bg-[#EFEBFF] rounded-2xl shadow-card border border-gray-200">
							<p className="font-semibold text-[#1A1A1A] flex items-center gap-2">
								<span className="text-[#464647] text-2xl leading-none">•</span>
								Ambitious Young Adults
							</p>
							<p className="text-base text-gray-700 mt-2">
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

			{/* ===================== SECTION 2 ===================== */}
			<div className="relative w-full mt-32 px-6 md:px-16 lg:px-24 z-[10]">
				{/* STARS BACKGROUND (Bottom Fade) */}
				<div className="absolute bottom-[-10%] left-0 w-full h-[600px] stars-mask pointer-events-none select-none">
					<Image
						src="/Icons/LandingIcons/Vector 6.png"
						alt="stars background"
						fill
						className="object-cover opacity-[0.55]"
					/>
				</div>

				<div className="grid md:grid-cols-2 gap-16 relative z-[20]">
					{/* ===================== LEFT COLUMN ===================== */}
					<div className="flex flex-col gap-10">
						{/* BULLET POINTS (LEFT) */}
						<div className="space-y-6 text-[#1A1A1A]">
							<p className="flex items-start gap-3 text-lg">
								<Image
									src="/Icons/Property 1=Done.svg"
									width={22}
									height={22}
									alt="check"
									className="mt-1"
								/>
								Simplifies Life with an Intelligent Assistance
							</p>

							<p className="flex items-start gap-3 text-lg">
								<Image
									src="/Icons/Property 1=Done.svg"
									width={22}
									height={22}
									alt="check"
									className="mt-1"
								/>
								Context Awareness and Personalization
							</p>

							<p className="flex items-start gap-3 text-lg">
								<Image
									src="/Icons/Property 1=Done.svg"
									width={22}
									height={22}
									alt="check"
									className="mt-1"
								/>
								Data Privacy and Ethical Automation
							</p>
						</div>

						{/* LEFT IMAGE (BIG UI FRAME) */}
						<div className="w-full rounded-2xl overflow-hidden shadow-xl">
							<Image
								src="/Icons/LandingIcons/Home_ Trigger.png"
								alt="UI screenshot right"
								width={900}
								height={600}
								className="w-full h-auto"
							/>
						</div>
					</div>

					{/* ===================== RIGHT COLUMN ===================== */}
					<div className="flex flex-col gap-10">
						{/* RIGHT TOP IMAGE */}
						<div className="w-full rounded-2xl overflow-hidden shadow-xl">
							<Image
								src="/Icons/LandingIcons/Home_ Add_New_Event.png"
								alt="UI screenshot right"
								width={900}
								height={600}
								className="w-full h-auto"
							/>
						</div>

						{/* BULLET POINTS (RIGHT) */}
						<div className="space-y-6 text-[#1A1A1A]">
							<p className="flex items-start gap-3 text-lg">
								<Image
									src="/Icons/Property 1=Done.svg"
									width={22}
									height={22}
									alt="check"
									className="mt-1"
								/>
								Voice-First, Reliable, and Personable
							</p>

							<p className="flex items-start gap-3 text-lg">
								<Image
									src="/Icons/Property 1=Done.svg"
									width={22}
									height={22}
									alt="check"
									className="mt-1"
								/>
								Powerful Productivity Features
							</p>

							<p className="flex items-start gap-3 text-lg">
								<Image
									src="/Icons/Property 1=Done.svg"
									width={22}
									height={22}
									alt="check"
									className="mt-1"
								/>
								Empowers Work-Life Balance
							</p>
						</div>

						{/* CTA BUTTON */}
						<div>
							<button className="bg-black text-white py-2 px-8 rounded-full text-lg font-normal shadow-lg hover:opacity-90 transition">
								Request Early Access
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
