/** @format */
"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Message {
	user: string;
	mira: string;
}

export default function ConversationFeed({
	messages,
}: {
	messages: Message[];
}) {
	if (!messages.length) return null;

	return (
		<div className="mt-10 w-full max-w-xl text-left space-y-6">
			{messages.map((msg, i) => (
				<MessageCard key={i} user={msg.user} mira={msg.mira} />
			))}
		</div>
	);
}

function MessageCard({ user, mira }: Message) {
	const [expanded, setExpanded] = useState(false);
	const MAX_LENGTH = 350;
	const isLong = mira.length > MAX_LENGTH;
	const displayText = expanded ? mira : mira.slice(0, MAX_LENGTH);

	return (
		<div className="relative bg-white/90 backdrop-blur-md border border-[#E4D9FF] rounded-2xl p-5 shadow-[0_4px_20px_rgba(180,150,255,0.15)] transition-all hover:shadow-[0_6px_25px_rgba(180,150,255,0.25)]">
			{/* Left accent line */}
			{/* <div className="absolute left-0 top-6 bottom-6 w-[3px] bg-gradient-to-b from-[#B794F4] to-[#E9D5FF] rounded-r-md" /> */}

			{/* You Section */}
			<div className="pl-4">
				<p className="text-gray-800 text-sm font-medium flex items-center gap-2 mb-1">
					<span className="w-2.5 h-2.5 bg-[#A1A1AA] rounded-full"></span>
					<span className="text-gray-900">You:</span>
					<span className="font-normal text-gray-700">{user}</span>
				</p>
			</div>

			{/* Mira Section */}
			<div className="pl-4 mt-2">
				<p className="text-gray-800 text-sm font-medium flex items-center gap-2 mb-2">
					<span className="w-2.5 h-2.5 bg-[#8B5CF6] rounded-full shadow-[0_0_6px_#C4A0FF]" />
					<span className="text-[#6B21A8] font-semibold">Mira:</span>
				</p>

                <div className="ml-4 border-l-[2px] border-[#E4D9FF] pl-4 text-[15px] text-gray-800 leading-relaxed">
                    {displayText.split("\n").map((line, idx) => (
                        <p key={idx} className="text-gray-800 leading-relaxed mb-2">{line}</p>
                    ))}

					{isLong && (
						<button
							onClick={() => setExpanded(!expanded)}
							className="mt-2 flex items-center gap-1 text-sm text-[#7C3AED] font-medium hover:text-[#6B21A8] transition-colors"
						>
							{expanded ? "See Less" : "See More"}
							<ChevronDown
								size={14}
								className={`transition-transform ${
									expanded ? "rotate-180" : ""
								}`}
							/>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
