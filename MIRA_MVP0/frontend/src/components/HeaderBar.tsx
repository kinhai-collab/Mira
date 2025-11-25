/** @format */

"use client";

import { Icon } from "@/components/Icon";

interface HeaderBarProps {
	dateLabel: string; // e.g., "Mon, Nov 24"
	locationLabel: string; // e.g., "Pittsburgh"
	temperatureLabel: string; // e.g., "12°"
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
	return (
		<div className="w-full flex items-center gap-3 text-sm px-4 py-2">
			{/* DATE */}
			<span className="font-medium text-gray-800">{dateLabel}</span>

			{/* LOCATION */}
			<div className="flex items-center gap-1 px-3 py-1 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm">
				<Icon name="Location" size={16} className="text-gray-600" />
				<span className="text-gray-700 font-medium">
					{isLocationLoading ? "Detecting..." : locationLabel}
				</span>
			</div>

			{/* WEATHER */}
			<div className="flex items-center gap-1 px-3 py-1 border border-gray-200 rounded-full bg-white/40 backdrop-blur-sm">
				<Icon name="Sun" size={16} className="text-yellow-500" />
				<span className="text-gray-700 font-medium">
					{isWeatherLoading ? "..." : temperatureLabel}
				</span>
			</div>
		</div>
	);
}
