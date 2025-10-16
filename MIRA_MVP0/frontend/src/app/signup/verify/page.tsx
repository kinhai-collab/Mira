/** @format */
"use client";

import { useRouter } from "next/navigation";

export default function VerifyPage() {
	const router = useRouter();

	const handleContinue = () => {
		router.push("/signup/complete");
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#EADCF8] to-[#F8E8FB] text-gray-800">
			<div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
				<h1 className="text-3xl font-semibold mb-3">Verify Your Email</h1>
				<p className="text-gray-500 mb-6">
					We’ve sent a verification link to your email. Please check your inbox.
				</p>
				<button
					onClick={handleContinue}
					className="bg-black text-white px-6 py-2 rounded-full hover:opacity-90 transition w-full"
				>
					Continue
				</button>
			</div>
		</div>
	);
}
