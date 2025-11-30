/** @format */
"use client";

import Image from "next/image";
import { Icon } from "@/components/Icon";
import { useState } from "react";

export default function FooterBar({
	alwaysShowInput = false,
	isListening,
	isTextMode,
	setIsListening,
	setIsTextMode,
	setIsConversationActive,
	setIsMuted,
	startMiraVoice,
	stopMiraVoice,
	setMiraMute,
	input,
	setInput,
	handleTextSubmit,
	isLoadingResponse,
	textMessages,
}: any) {
	const hasStarted = alwaysShowInput || textMessages.length > 0;

	return (
		<>
			{/* Desktop view */}
			<div className="w-full fixed bottom-4 left-10 flex flex-col items-center z-50 px-4">
				{hasStarted && (
					<div className="w-full max-w-[660px] mt-6 mb-4 transition-all duration-500 transform animate-slideDownToFooter">
						<div className="rounded-[10px] bg-gradient-to-r from-[#F4A4D3] to-[#B5A6F7] p-[1.5px] shadow-[0_12px_35px_rgba(181,166,247,0.45)]">
							<div className="flex items-center rounded-[10px] bg-white px-4 py-1">
								<input
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											setIsConversationActive(true);
											handleTextSubmit();
										}
									}}
									placeholder={
										isListening ? "I'm listening..." : "Type your request..."
									}
									className="flex-1 px-3 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none text-sm"
								/>
								<button
									onClick={() => {
										setIsConversationActive(true);
										handleTextSubmit();
									}}
									disabled={!input.trim()}
									className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm disabled:opacity-50"
								>
									<Icon name="Send" size={16} />
								</button>
							</div>
						</div>
					</div>
				)}

				{/* TOGGLE BAR (mic / keyboard) */}
				<div className="relative w-[140px] mb-4">
					<div className="w-[140px] h-[34px] border border-black bg-white rounded-full shadow flex items-center justify-between px-[6px]">
						{/* MIC BUTTON */}
						<button
							onClick={() => {
								setIsListening(true);
								setIsTextMode(false);
								setIsConversationActive(true);
								startMiraVoice();
							}}
							className={`w-[55px] h-[26px] flex items-center justify-center rounded-full transition ${
								isListening ? "bg-black" : "bg-white"
							} border border-gray-300`}
						>
							<Image
								src={
									isListening
										? "/Icons/Property 1=Mic.svg"
										: "/Icons/Property 1=MicOff.svg"
								}
								alt="Mic"
								width={14}
								height={14}
								className={isListening ? "invert" : ""}
							/>
						</button>

						{/* KEYBOARD BUTTON */}
						<button
							onClick={() => {
								setIsTextMode(true);
								setIsListening(false);
								setIsConversationActive(false);
								stopMiraVoice();
								setIsMuted(false);
								setMiraMute(false);
							}}
							className={`w-[55px] h-[26px] flex items-center justify-center rounded-full transition ${
								isTextMode ? "bg-black" : "bg-white"
							} border border-gray-300`}
						>
							<Image
								src="/Icons/Property 1=Keyboard.svg"
								alt="Keyboard Icon"
								width={14}
								height={14}
								className={isTextMode ? "invert" : ""}
							/>
						</button>
					</div>
				</div>
			</div>
			{/* Moblie view */}
			{/* MOBILE VIEW FOOTER */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 py-3 z-[999]">
				<div className="w-full flex flex-col items-center px-4">
					{/* INPUT BOX */}
					<div className="w-full mb-3">
						<div className="rounded-[10px] bg-gradient-to-r from-[#F4A4D3] to-[#B5A6F7] p-[1.5px] shadow-[0_10px_25px_rgba(181,166,247,0.35)]">
							<div className="flex items-center rounded-[10px] bg-white px-3 py-1">
								<input
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											setIsConversationActive(true);
											handleTextSubmit();
										}
									}}
									placeholder={
										isListening ? "I'm listening..." : "Type your request..."
									}
									className="flex-1 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none text-sm"
								/>

								<button
									onClick={() => {
										setIsConversationActive(true);
										handleTextSubmit();
									}}
									disabled={!input.trim()}
									className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm disabled:opacity-50"
								>
									<Icon name="Send" size={14} />
								</button>
							</div>
						</div>
					</div>

					{/* MIC / KEYBOARD TOGGLE (same size as other mobile nav buttons) */}
					<div className="flex items-center justify-center gap-3 w-full">
						<button
							onClick={() => {
								setIsListening(true);
								setIsTextMode(false);
								setIsConversationActive(true);
								startMiraVoice();
							}}
							className={`w-10 h-10 flex items-center justify-center rounded-lg border shadow-sm transition ${
								isListening
									? "bg-black border-black"
									: "bg-white border-gray-200"
							}`}
						>
							<Image
								src={
									isListening
										? "/Icons/Property 1=Mic.svg"
										: "/Icons/Property 1=MicOff.svg"
								}
								alt="Mic"
								width={16}
								height={16}
								className={isListening ? "invert" : ""}
							/>
						</button>

						<button
							onClick={() => {
								setIsTextMode(true);
								setIsListening(false);
								setIsConversationActive(false);
								stopMiraVoice();
								setIsMuted(false);
								setMiraMute(false);
							}}
							className={`w-10 h-10 flex items-center justify-center rounded-lg border shadow-sm transition ${
								isTextMode
									? "bg-black border-black"
									: "bg-white border-gray-200"
							}`}
						>
							<Image
								src="/Icons/Property 1=Keyboard.svg"
								alt="Keyboard Icon"
								width={16}
								height={16}
								className={isTextMode ? "invert" : ""}
							/>
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
