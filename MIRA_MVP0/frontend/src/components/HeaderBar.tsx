/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { setMiraMute } from "@/utils/voice/voiceHandler";
import Image from "next/image";

interface HeaderBarProps {
	dateLabel: string;
	locationLabel: string;
	temperatureLabel: string;
	weatherCode?: number | null;
	isLocationLoading?: boolean;
	isWeatherLoading?: boolean;
}

export default function HeaderBar({
	dateLabel,
	locationLabel,
	temperatureLabel,
	weatherCode,
	isLocationLoading = false,
	isWeatherLoading = false,
}: HeaderBarProps) {
	const router = useRouter();
	const [isMuted, setIsMuted] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

	const handleMuteToggle = () => {
		const next = !isMuted;
		setIsMuted(next);
		setMiraMute(next);
	};
	function getWeatherIconPath(code: number, isNight: boolean) {
		const base = "/Icons/Weather icons/";

		// NIGHT
		if (isNight) {
			if (code === 0) return `${base}Property 1=Night.png`;
			if (code === 1 || code === 2 || code === 3)
				return `${base}Property 1=Cloudy.png`;

			if (code === 45 || code === 48) return `${base}Property 1=Fog.png`;
			if (code >= 51 && code <= 67) return `${base}Property 1=Rain.png`;
			if (code >= 71 && code <= 77) return `${base}Property 1=Snow.png`;
			if (code >= 80 && code <= 82) return `${base}Property 1=Rain.png`;
			if (code >= 95) return `${base}Property 1=Thunderstorm.png`;

			return `${base}Property 1=Cloudy.png`;
		}

		// DAY
		if (code === 0) return `${base}Property 1=Sunny.png`;
		if (code === 1 || code === 2) return `${base}Property 1=Partly Cloudy.png`;
		if (code === 3) return `${base}Property 1=Cloudy.png`;

		if (code === 45 || code === 48) return `${base}Property 1=Fog.png`;
		if (code >= 51 && code <= 67) return `${base}Property 1=Rain.png`;
		if (code >= 71 && code <= 77) return `${base}Property 1=Snow.png`;
		if (code >= 80 && code <= 82) return `${base}Property 1=Rain.png`;
		if (code >= 95) return `${base}Property 1=Thunderstorm.png`;

		return `${base}Property 1=Cloudy.png`;
	}

	return (
		<div className="fixed top-0 z-20 w-[94vw] bg-[#F8F8FB]/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
			{/* LEFT SECTION */}
			<div className="flex pl-[20] items-center gap-2 text-sm flex-nowrap">
				{" "}
				<span className="font-normal text-gray-800 whitespace-nowrap">
					{dateLabel}
				</span>
				<div className="flex items-center gap-1 px-2 py-0.5 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm whitespace-nowrap">
					<Icon name="Location" size={14} className="text-gray-600" />
					<span className="text-gray-700 font-normal text-sm">
						{isLocationLoading ? "..." : locationLabel}
					</span>
				</div>
				<div className="flex items-center gap-1 px-2 py-0.5 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm whitespace-nowrap">
					<Image
						src={getWeatherIconPath(
							weatherCode ?? 0,
							new Date().getHours() < 6 || new Date().getHours() >= 19
						)}
						alt="Weather"
						width={14}
						height={14}
						className="inline-block"
					/>

					<span className="text-gray-700 font-normal text-sm">
						{isWeatherLoading ? "..." : temperatureLabel}
					</span>
				</div>
			</div>

			{/* RIGHT SECTION — DESKTOP */}
			<div className="hidden md:flex items-center gap-3 ml-auto">
				<button
					onClick={() => router.push("/scenarios/morning-brief")}
					className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FFF8E7] border border-[#FFE9B5] rounded-full text-sm font-medium text-[#B58B00] shadow-sm hover:shadow-md transition"
				>
					<Icon name="Sun" size={16} className="text-yellow-500" />
					<span>Morning Brief</span>
				</button>

				<button
					onClick={handleMuteToggle}
					className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium shadow-sm border transition
          ${
						isMuted
							? "bg-[#E8ECF9] border-[#B8C7F2] text-[#5568A2]"
							: "bg-[#F5F5F5] border-gray-200 text-gray-700"
					}`}
				>
					<Icon
						name={isMuted ? "VoiceOff" : "VoiceOn"}
						size={18}
						className="opacity-80"
					/>
					<span>{isMuted ? "Muted" : "Mute"}</span>
				</button>
			</div>

			{/* RIGHT SECTION — MOBILE (HAMBURGER) */}
			<div className="md:hidden relative">
				<button
					onClick={() => setMenuOpen((prev) => !prev)}
					className="p-2 rounded-md bg-white/70 border border-gray-200 shadow-sm"
				>
					{/* Hamburger icon */}
					<div className="space-y-1">
						<div className="w-5 h-[2px] bg-gray-700" />
						<div className="w-5 h-[2px] bg-gray-700" />
						<div className="w-5 h-[2px] bg-gray-700" />
					</div>
				</button>

				{/* DROPDOWN MENU */}
				{menuOpen && (
					<div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg w-40 py-2 z-50">
						<button
							onClick={() => {
								router.push("/scenarios/morning-brief");
								setMenuOpen(false);
							}}
							className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
						>
							<Icon name="Sun" size={16} className="text-yellow-500" />
							Morning Brief
						</button>

						<button
							onClick={() => {
								handleMuteToggle();
								setMenuOpen(false);
							}}
							className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
						>
							<Icon name={isMuted ? "VoiceOff" : "VoiceOn"} size={16} />
							{isMuted ? "Unmute" : "Mute"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
