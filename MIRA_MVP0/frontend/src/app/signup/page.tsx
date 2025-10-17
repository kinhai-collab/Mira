/** @format */
"use client";

import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function SignupPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

	const handleNavigate = (path: string) => {
		router.push(path);
	};

	const handleSignup = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			// Prepare form data using URLSearchParams
			const formData = new URLSearchParams();
			formData.append("email", email);
			formData.append("password", password);

			// Send POST request to backend signup endpoint
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/signup`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: formData.toString(),
			});
            
			// Handle response if signup failed
			if (!res.ok) {
				const errorData = await res.json();
				console.error("Signup failed:", errorData);
				alert(errorData.detail?.message || "Signup failed");
				setLoading(false);
				return;
			}

			const data = await res.json();
			console.log("Signup success:", data);
			alert("Signup successful!");
			// Save email for onboarding
			try { localStorage.setItem("mira_email", email); } catch {}

			
			// Redirect user to onboarding step 1
			router.push("/onboarding/step1");
		} catch (err) {
			console.error("Error during signup:", err);
			alert("Something went wrong, please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignup = () => {
		console.log("Google signup");
		// Add Google signup logic here
		router.push("/onboarding/step1");
	};

	const handleAppleSignup = () => {
		console.log("Apple signup");
		// Add Apple signup logic here
		router.push("/onboarding/step1");
	};

	return (
		<div className="flex h-screen bg-gradient-to-b from-[#d0c7fa] to-[#fbdbed]">
			{/* Sidebar */}
			<Sidebar onNavigate={handleNavigate} />

			{/* Main content */}
			<main className="flex-1 flex justify-center items-center px-4 overflow-y-auto">
				<div className="bg-[#f7f8fa] p-8 rounded-lg w-full max-w-[600px]">
					{/* Header */}
					<div className="flex flex-col gap-4 mb-10">
						<h1 className="text-[36px] leading-[40px] font-normal text-[#272829] font-['Outfit',_sans-serif]">
							Welcome to Mira
						</h1>
						<p className="text-[18px] leading-[12px] text-[#272829] font-['Outfit',_sans-serif]">
							You already have an account?{" "}
							<a
								href="/login"
								className="font-semibold underline decoration-solid underline-offset-4"
							>
								Log in
							</a>
						</p>
					</div>

					{/* Form */}
					<form onSubmit={handleSignup} className="flex flex-col gap-5 mb-5">
						<div className="flex flex-col gap-4">
							<label className="text-[18px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
								Email
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="bg-[#fbfcfd] h-[54px] rounded-lg shadow-[0px_0px_4px_0px_rgba(0,0,0,0.25)] px-4 text-[18px] font-['Outfit',_sans-serif] focus:outline-none focus:ring-2 focus:ring-[#d0c7fa]"
								placeholder="Enter your email"
							/>
						</div>

						<div className="flex flex-col gap-4">
							<label className="text-[18px] font-normal text-[#454547] font-['Outfit',_sans-serif]">
								Password
							</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="bg-[#fbfcfd] h-[54px] rounded-lg shadow-[0px_0px_4px_0px_rgba(0,0,0,0.25)] px-4 text-[18px] font-['Outfit',_sans-serif] focus:outline-none focus:ring-2 focus:ring-[#d0c7fa]"
								placeholder="Enter your password"
							/>
						</div>

						<button
							type="submit"
							className="bg-[#272829] text-[#fbfcfd] h-[54px] rounded-[50px] text-[18px] font-normal font-['Outfit',_sans-serif] hover:bg-[#454547] transition-colors"
						>
							Create account
						</button>
					</form>

					{/* Divider */}
					<div className="flex items-center gap-[14px] mb-8">
						<div className="flex-1 h-0 border-t border-[#96989c]"></div>
						<span className="text-[18px] text-[#96989c] font-['Outfit',_sans-serif]">
							Or continue with
						</span>
						<div className="flex-1 h-0 border-t border-[#96989c]"></div>
					</div>

					{/* Social Signup Buttons */}
					<div className="flex flex-col gap-5">
						<button
							onClick={handleGoogleSignup}
							className="bg-white rounded-[50px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.08),0px_2px_3px_0px_rgba(0,0,0,0.17)] p-4 flex items-center justify-center gap-[15px] hover:shadow-[0px_0px_6px_0px_rgba(0,0,0,0.12),0px_4px_6px_0px_rgba(0,0,0,0.25)] transition-shadow"
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<FcGoogle size={24} />
							</div>
							<span className="text-[18px] font-medium text-[rgba(0,0,0,0.54)] font-['Outfit',_sans-serif]">
								Sign Up with Google
							</span>
						</button>

						<button
							onClick={handleAppleSignup}
							className="bg-[#272829] rounded-[50px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.08),0px_2px_3px_0px_rgba(0,0,0,0.17)] p-4 flex items-center justify-center gap-[15px] hover:bg-[#454547] transition-colors"
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<FaApple size={24} className="text-white" />
							</div>
							<span className="text-[18px] font-normal text-white font-['Outfit',_sans-serif]">
								Sign Up with Apple
							</span>
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
