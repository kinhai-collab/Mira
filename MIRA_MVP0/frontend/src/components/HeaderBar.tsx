/** @format */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { setMiraMute } from "@/utils/voice/voiceHandler";

interface HeaderBarProps {
	dateLabel: string;
	locationLabel: string;
	temperatureLabel: string;
	isLocationLoading?: boolean;
	isWeatherLoading?: boolean;
}

export default function HeaderBar({
	dateLabel,
	locationLabel,
	temperatureLabel,
	isLocationLoading = false,
	isWeatherLoading = false,
}: HeaderBarProps) {
	const router = useRouter();
	const [isMuted, setIsMuted] = useState(false);

	const handleMuteToggle = () => {
		const next = !isMuted;
		setIsMuted(next);
		setMiraMute(next);
	};

	return (
		<div className="sticky top-0 z-50 w-full bg-[#F8F8FB]/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
			{/* LEFT — Date + Location + Weather */}
			<div className="flex items-center gap-3 text-sm">
				<span className="font-medium text-gray-800">{dateLabel}</span>

				<div className="flex items-center gap-1 px-3 py-1 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm">
					<Icon name="Location" size={16} className="text-gray-600" />
					<span className="text-gray-700 font-medium">
						{isLocationLoading ? "Detecting..." : locationLabel}
					</span>
				</div>

				<div className="flex items-center gap-1 px-3 py-1 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm">
					<Icon name="Sun" size={16} className="text-yellow-500" />
					<span className="text-gray-700 font-medium">
						{isWeatherLoading ? "..." : temperatureLabel}
					</span>
				</div>
			</div>

			{/* RIGHT — Morning Brief + Mute */}
			<div className="flex items-center gap-3">
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
		</div>
	);
}
