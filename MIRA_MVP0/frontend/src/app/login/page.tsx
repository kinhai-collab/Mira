/** @format */
"use client";

import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useState } from "react";

export default function LoginPage() {
	const router = useRouter();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleNavigate = (path: string) => {
		router.push(path);
	};

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		console.log("Login attempt:", { email, password });
		setLoading(true);
		try {
			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			const endpoint = `${apiBase}/signin`;
			const formData = new FormData();
			formData.append("email", email);
			formData.append("password", password);

			const res = await fetch(endpoint, {
				method: "POST",
				body: formData,
			});

			if (!res.ok) throw new Error("Invalid credentials");
			const data = await res.json();

			localStorage.setItem("token", data.access_token);
			router.push("/dashboard");
		} catch (err) {
			alert("Login failed. Please check your credentials.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleLogin = () => {
		console.log("Google login clicked");
		const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
		window.location.href = `${apiBase}/auth/google`;
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			{/* Sidebar - visible only on md+ */}
			<aside className="hidden md:flex w-20 bg-[#F0ECF8] flex-col items-center justify-between py-6 border-r border-gray-200">
				{/* Top Section */}
				<div className="flex flex-col items-center space-y-6">
					{/* Mira orb → Home */}
					<div
						onClick={() => router.push("/")}
						className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 shadow-md cursor-pointer hover:scale-110 hover:shadow-[0_0_15px_4px_rgba(200,150,255,0.4)] transition-transform"
						title="Go Home"
					/>

					{/* Sidebar icons */}
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								onClick={() => {
									if (name === "Dashboard") router.push("/dashboard");
									else router.push(`/dashboard/${name.toLowerCase()}`);
								}}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
							>
								<Icon
									name={name}
									size={22}
									className="opacity-80 hover:opacity-100 transition"
								/>
							</div>
						))}
					</div>
				</div>

				{/* Profile Icon */}
				<div
					onClick={() => router.push("/dashboard/profile")}
					className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
					title="Profile"
				>
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			{/* Main content */}
			<main className="flex flex-1 justify-center items-center px-4 md:px-10 overflow-y-auto py-10 md:py-0">
				<div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 md:p-10 w-full max-w-md sm:max-w-lg">
					<h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2 text-center">
						Welcome back to Mira
					</h1>
					<p className="text-gray-500 text-center mb-6 text-sm sm:text-base">
						You don’t have an account?{" "}
						<a
							href="/signup"
							className="underline text-purple-500 hover:text-purple-600"
						>
							Sign up
						</a>
					</p>

					<form onSubmit={handleLogin} className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-600 mb-1">
								Email
							</label>
							<input
								type="email"
								className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-600 mb-1">
								Password
							</label>
							<input
								type="password"
								className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
								placeholder="•••••••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full bg-black text-white py-2.5 rounded-full font-medium hover:opacity-90 transition text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{loading ? "Logging in..." : "Log in"}
						</button>
					</form>

					<p className="text-sm text-center mt-3 text-gray-500 hover:text-gray-700 cursor-pointer">
						Forgot your password?
					</p>

					<div className="flex items-center gap-2 my-6">
						<div className="h-[1px] flex-1 bg-gray-200"></div>
						<span className="text-gray-400 text-xs sm:text-sm">
							Or continue with
						</span>
						<div className="h-[1px] flex-1 bg-gray-200"></div>
					</div>

					<div className="space-y-3">
						<button onClick={handleGoogleLogin} className="w-full border border-gray-300 flex items-center justify-center gap-3 py-2 rounded-full hover:bg-gray-50 transition text-sm sm:text-base">
							<FcGoogle size={20} />
							<span className="font-medium text-gray-700">
								Log in with Google
							</span>
						</button>

						<button className="w-full bg-black text-white flex items-center justify-center gap-3 py-2 rounded-full hover:opacity-90 transition text-sm sm:text-base">
							<FaApple size={20} />
							<span className="font-medium">Log in with Apple</span>
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
