/** @format */
"use client";

import Image from "next/image";
import Link from "next/link";

import StarFlowBackground from "@/components/landing/StarFlowBackground";

export default function LandingPage() {
	return (
		<div
			className="relative w-full min-h-screen flex flex-col items-center px-4 md:px-10 py-20 overflow-hidden"
			style={{
				background: "linear-gradient(180deg, #D0C7FA 0%, #FBDBED 100%)",
			}}
		>
			{/* ===================== LEFT ORB ===================== */}
			<div
				style={{
					position: "absolute",
					width: "40px",
					height: "40px",
					left: "26px",
					top: "24px",
					background: "linear-gradient(135deg, #E1B5FF 0%, #C4A0FF 100%)", // Assumed gradient based on shadow/context
					borderRadius: "50%",
					boxShadow: "0px 0px 10px 0px #BAB2DA",
					zIndex: 50,
				}}
			/>

			{/* ===================== HEADER ===================== */}
			<div
				style={{
					position: "absolute",
					width: "745px",
					height: "192px",
					left: "calc(50% - 745px/2 - 2.5px)",
					top: "165px",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					padding: "0px",
					gap: "8px",
					zIndex: 20,
				}}
			>
				{/* Row 1: Welcome to Mira */}
				<div
					style={{
						display: "flex",
						flexDirection: "row",
						alignItems: "center",
						padding: "0px",
						gap: "8px",
						width: "457px",
						height: "76px",
						flex: "none",
						order: 0,
						flexGrow: 0,
					}}
				>
					<span
						style={{
							width: "322px",
							height: "76px",
							fontFamily: "'Outfit', sans-serif",
							fontStyle: "normal",
							fontWeight: 600,
							fontSize: "60px",
							lineHeight: "76px",
							textAlign: "center",
							letterSpacing: "0.005em",
							color: "#282829",
						}}
					>
						Welcome to
					</span>
					<span
						style={{
							width: "127px",
							height: "76px",
							fontFamily: "'Outfit', sans-serif",
							fontStyle: "normal",
							fontWeight: 600,
							fontSize: "60px",
							lineHeight: "76px",
							textAlign: "center",
							letterSpacing: "0.005em",
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
				<div
					style={{
						width: "745px",
						height: "50px",
						fontFamily: "'Outfit', sans-serif",
						fontStyle: "normal",
						fontWeight: 500,
						fontSize: "40px",
						lineHeight: "50px",
						textAlign: "center",
						letterSpacing: "0.005em",
						color: "#282829",
						flex: "none",
						order: 1,
						alignSelf: "stretch",
						flexGrow: 0,
					}}
				>
					Your Proactive Personal Assistant that
				</div>

				{/* Row 3: gives you time back... */}
				<div
					style={{
						width: "745px",
						height: "50px",
						fontFamily: "'Outfit', sans-serif",
						fontStyle: "normal",
						fontWeight: 500,
						fontSize: "40px",
						lineHeight: "50px",
						textAlign: "center",
						letterSpacing: "0.005em",
						flex: "none",
						order: 2,
						alignSelf: "stretch",
						flexGrow: 0,
					}}
				>
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
					<span style={{ color: "#282829" }}>to do things you love.</span>
				</div>
			</div>

			{/* ===================== RADIAL GRADIENT (Behind Box) ===================== */}
			<div
				style={{
					position: "absolute",
					width: "1051.72px",
					height: "799.22px",
					left: "-72px",
					top: "959px",
					background:
						"radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%)",
					transform: "rotate(-30.81deg)",
					opacity: 1,
					backdropFilter: "blur(20px)",
					zIndex: 5,
					pointerEvents: "none",
				}}
			/>

			{/* ===================== MAIN CONTENT ===================== */}
			<div className="relative w-full mt-[400px] flex flex-col md:flex-row md:justify-between md:items-start px-6">
				{/* ===================== LEFT SIDE ===================== */}
				<div className="relative w-full md:w-1/2 flex justify-center md:justify-start">
					{/* ==== BIG STAR CLOUD ABOVE THE BOX ==== */}
					<div
						className="stars-mask"
						style={{
							position: "absolute",
							width: "600px",
							height: "550px",
							top: "0px",
							left: "200px",
							opacity: 1,
							zIndex: 12,
						}}
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
						className="absolute left-[90%] top-[25%] z-[25]"
					/>

					{/* ==== RIGHT ARROW (up curve) ==== */}
					<Image
						src="/Icons/LandingIcons/Arrow 6.png"
						alt="right arrow down"
						width={50}
						height={50}
						className="absolute right-[75%] top-[22%] z-[25]"
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
			{/* <div className="mt-12 flex justify-center relative z-[50]">
				<Link href="/login">
					<button
						className="bg-black text-white py-3 px-10 rounded-full text-lg font-medium shadow-lg
                       transition-all duration-300 ease-out
                       hover:opacity-90 hover:shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:-translate-y-1"
					>
						Get Started
					</button>
				</Link>
			</div> */}
			{/* ===================== SECTION 2 (FEATURES) ===================== */}
			<div className="relative w-full mt-32 px-6 md:px-16 lg:px-24 z-[10] flex justify-center">
				{/* STAR FLOW BACKGROUND */}
				<div className="absolute bottom-[-20%] left-0 w-full h-full z-[0] pointer-events-none overflow-hidden flex justify-center items-end">
					<div className="w-[1690px] h-[1014px] relative opacity-60">
						<StarFlowBackground />
					</div>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "flex-start",
						padding: "0px",
						gap: "200px",
						width: "1126px",
						maxWidth: "100%", // Responsive fallback
						position: "relative",
						zIndex: 20,
					}}
				>
					{/* ===================== ROW 1 (Frame 1357) ===================== */}
					<div
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							padding: "0px",
							gap: "120px",
							width: "1126px",
							maxWidth: "100%",
							flexWrap: "wrap", // Responsive wrap
						}}
					>
						{/* LEFT: Text Content (Frame 1343) */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								justifyContent: "center",
								alignItems: "flex-start",
								padding: "0px",
								gap: "40px",
								width: "506px",
								height: "170px",
								flex: "none",
								order: 0,
								flexGrow: 0,
							}}
						>
							{[
								"Simplifies Life with an Intelligent Assistance",
								"Context Awareness and Personalization",
								"Data Privacy and Ethical Automation",
							].map((text, i) => (
								<div
									key={i}
									style={{
										display: "flex",
										flexDirection: "row",
										alignItems: "center",
										padding: "0px",
										gap: "8px", // Updated gap from 4px to 8px per Frame 1338/1341/1342
										width: "506px", // Matches Frame width
										height: "30px",
									}}
								>
									<div
										style={{
											width: "30px",
											height: "30px",
											flex: "none",
											order: 0,
											flexGrow: 0,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										{/* Vector Icon */}
										<div
											style={{
												width: "24px",
												height: "18px",
												background: "#282829",
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
									<span
										style={{
											fontFamily: "'Outfit', sans-serif",
											fontStyle: "normal",
											fontWeight: 500,
											fontSize: "24px",
											lineHeight: "30px",
											letterSpacing: "0.005em",
											color: "#282829",
											flex: "none",
											order: 1,
											flexGrow: 0,
										}}
									>
										{text}
									</span>
								</div>
							))}
						</div>

						{/* RIGHT: Image (Rectangle) */}
						<div
							style={{
								width: "500px",
								height: "316px",
								background:
									"url('/Icons/LandingIcons/Home_ Add_New_Event.png')",
								backgroundSize: "cover",
								backgroundPosition: "center",
								filter: "drop-shadow(0px 4px 24px rgba(0, 0, 0, 0.2))",
								borderRadius: "12px",
								flex: "none",
								order: 1,
								flexGrow: 0,
							}}
						/>
					</div>

					{/* ===================== ROW 2 (Frame 1358) ===================== */}
					<div
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							padding: "0px",
							gap: "120px",
							width: "1126px",
							maxWidth: "100%",
							flexWrap: "wrap",
						}}
					>
						{/* LEFT: Image (Rectangle) */}
						<div
							style={{
								width: "500px",
								height: "316px",
								background: "url('/Icons/LandingIcons/Home_ Trigger.png')",
								backgroundSize: "cover",
								backgroundPosition: "center",
								filter: "drop-shadow(0px 4px 24px rgba(0, 0, 0, 0.2))",
								borderRadius: "12px",
								flex: "none",
								order: 0,
								flexGrow: 0,
							}}
						/>

						{/* RIGHT: Content (Frame 1356) */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "flex-start",
								padding: "0px",
								gap: "56px",
								width: "506px",
								height: "280px",
								flex: "none",
								order: 1,
								flexGrow: 0,
							}}
						>
							{/* Text List (Frame 1344) */}
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									padding: "0px",
									gap: "40px",
									width: "506px",
									height: "170px",
									flex: "none",
									order: 0,
									alignSelf: "stretch",
									flexGrow: 0,
								}}
							>
								{[
									"Voice-First, Reliable, and Personable",
									"Powerful Productivity Features",
									"Empowers Work-Life Balance",
								].map((text, i) => (
									<div
										key={i}
										style={{
											display: "flex",
											flexDirection: "row",
											alignItems: "center",
											padding: "0px",
											gap: "4px", // Frame 1339/1340/1342 specify 4px gap here
											width: "506px",
											height: "30px",
										}}
									>
										<div
											style={{
												width: "30px",
												height: "30px",
												flex: "none",
												order: 0,
												flexGrow: 0,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											{/* Vector Icon */}
											<div
												style={{
													width: "24px",
													height: "18px",
													background: "#282829",
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
										<span
											style={{
												fontFamily: "'Outfit', sans-serif",
												fontStyle: "normal",
												fontWeight: 500,
												fontSize: "24px",
												lineHeight: "30px",
												letterSpacing: "0.005em",
												color: "#282829",
												flex: "none",
												order: 1,
												flexGrow: 0,
											}}
										>
											{text}
										</span>
									</div>
								))}
							</div>

							{/* CTA BUTTON (Frame 998 + Frame 983) */}
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									padding: "0px",
									gap: "12px",
									width: "506px",
									height: "54px",
									flex: "none",
									order: 1,
									flexGrow: 0,
								}}
							>
								<button
									style={{
										display: "flex",
										flexDirection: "row",
										justifyContent: "center",
										alignItems: "center",
										padding: "12px 24px",
										width: "506px",
										height: "54px",
										background: "#282829",
										borderRadius: "50px",
										flex: "none",
										order: 0,
										alignSelf: "stretch",
										flexGrow: 0,
										border: "none",
										cursor: "pointer",
									}}
								>
									<span
										style={{
											width: "226px",
											height: "30px",
											fontFamily: "'Outfit', sans-serif",
											fontStyle: "normal",
											fontWeight: 500,
											fontSize: "24px",
											lineHeight: "30px",
											letterSpacing: "0.005em",
											color: "#FBFCFD",
											flex: "none",
											order: 0,
											flexGrow: 0,
										}}
									>
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
