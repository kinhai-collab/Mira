/** @format */
"use client";

import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useState, useEffect } from "react";
import { isAuthenticated } from "@/utils/auth";
import { supabase } from "@/utils/supabaseClient";

export default function SignupPage() {
	const router = useRouter();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated()) {
			router.push('/');
		}
	}, [router]);


	const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		console.log("Signup attempt:", { email, password });
		setLoading(true);

		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			const endpoint = `${apiBase}/signup`;
			const formData = new URLSearchParams();
			formData.append("email", email);
			formData.append("password", password);

			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: formData.toString(),
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				console.error("Signup failed:", errorData);
				const errorMessage = (errorData as { detail?: { message?: string } })?.detail?.message || "Signup failed";
				alert(errorMessage);
				setLoading(false);
				return;
			}

			const data = await res.json().catch(() => ({}));
			console.log("Signup success:", data);
			
			// Save user information for onboarding and profile display
			try { 
				localStorage.setItem("mira_email", email);
				localStorage.setItem("mira_provider", "email");
				// Note: User will complete profile info during onboarding
			} catch {}
			
			alert("Signup successful!");
			router.push("/onboarding/step1");
		} catch (err) {
			console.error("Error during signup:", err);
			alert("Something went wrong, please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleSignup = async () => {
		console.log("Google signup clicked");
		try {
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: `${window.location.origin}/auth/callback`
				}
			});
			
			if (error) {
				console.error("Google OAuth error:", error);
				alert("Google signup failed. Please try again.");
			}
		} catch (err) {
			console.error("Error during Google signup:", err);
			alert("Something went wrong with Google signup. Please try again.");
		}
	};

	return (
		<div className="h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Main Signup Content */}
			<main className="flex justify-center items-center px-4 md:px-10 overflow-y-auto py-10 md:py-0 h-full">
				<div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 md:p-10 w-full max-w-md sm:max-w-lg">
					{/* Header */}
					<h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2 text-center">
						Welcome to Mira
					</h1>
					<p className="text-gray-500 text-center mb-6 text-sm sm:text-base">
						Already have an account?{" "}
						<a
							href="/login"
							className="underline text-purple-500 hover:text-purple-600"
						>
							Log in
						</a>
					</p>

					{/* Form */}
					<form onSubmit={handleSignup} className="space-y-4">
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-600 mb-1"
							>
								Email
							</label>
							<input
								type="email"
								id="email"
								required
						className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
								placeholder="you@example.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-600 mb-1"
							>
								Password
							</label>
							<input
								type="password"
								id="password"
								required
						className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
								placeholder="•••••••••••••"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
							/>
						</div>

						{/* Create Account Button */}
					<button
						type="submit"
						disabled={loading}
						className="w-full bg-black text-white py-2.5 rounded-full font-medium hover:opacity-90 transition text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{loading ? "Creating..." : "Create account"}
					</button>
					</form>

					{/* Divider */}
					<div className="flex items-center gap-2 my-6">
						<div className="h-[1px] flex-1 bg-gray-200"></div>
						<span className="text-gray-400 text-xs sm:text-sm">
							Or continue with
						</span>
						<div className="h-[1px] flex-1 bg-gray-200"></div>
					</div>

					{/* Social Buttons */}
					<div className="space-y-3">
					<button onClick={handleGoogleSignup} className="w-full border border-gray-300 flex items-center justify-center gap-3 py-2 rounded-full hover:bg-gray-50 transition text-sm sm:text-base">
							<FcGoogle size={20} />
							<span className="font-medium text-gray-700">
								Sign Up with Google
							</span>
						</button>

						<button className="w-full bg-black text-white flex items-center justify-center gap-3 py-2 rounded-full hover:opacity-90 transition text-sm sm:text-base">
							<FaApple size={20} />
							<span className="font-medium">Sign Up with Apple</span>
						</button>
					</div>
				</div>
			</main>

			{/* Bottom Nav (Mobile only) */}
			<div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around py-3">
				{["Dashboard", "Settings", "Reminder", "Profile"].map((name, i) => (
					<div
						key={i}
						onClick={() => {
							if (name === "Dashboard") router.push("/dashboard");
							else if (name === "Profile") router.push("/dashboard/profile");
							else router.push(`/dashboard/${name.toLowerCase()}`);
						}}
						className="flex flex-col items-center text-gray-700"
					>
						<Icon name={name} size={20} />
					</div>
				))}
			</div>
		</div>
	);
}