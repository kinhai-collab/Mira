/** @format */
import React from "react";

export default function Orb() {
	return (
		<div
			className="
				rounded-full animate-pulse 
				w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56
				transition-all duration-500 ease-in-out
			"
			style={{
				background: "radial-gradient(circle, #F9C8E4 0%, #B5A6F7 100%)",
				boxShadow: "0 0 40px 10px #BAB2DA",
				filter: "blur(0.3px)",
			}}
		></div>
	);
}
