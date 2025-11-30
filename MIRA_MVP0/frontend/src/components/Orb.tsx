/** @format */
"use client";

interface OrbProps {
	hasMessages: boolean; // true when conversation has started
}

export default function Orb({ hasMessages }: OrbProps) {
	return (
		<div className="flex justify-center w-full">
			<div
				className={`
                    ${hasMessages ? "mt-4" : "mt-20"}
                    w-32 h-32 
                    sm:w-44 sm:h-44 
                    rounded-full 
                    bg-gradient-to-br 
                    from-[#C4A0FF] via-[#E1B5FF] to-[#F5C5E5] 
                    shadow-[0_0_80px_15px_rgba(210,180,255,0.45)]
                    animate-pulse
                `}
			/>
		</div>
	);
}
