/** @format */
"use client";

import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
	const router = useRouter();

	return (
		<div className="flex h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
			<aside className="w-20 bg-[#F0ECF8] flex flex-col items-center justify-between py-6 border-r border-gray-200">
				<div className="flex flex-col items-center space-y-6">
					<div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-purple-400" />
					<div className="flex flex-col items-center gap-5 mt-4">
						{["Dashboard", "Settings", "Reminder"].map((name, i) => (
							<div
								key={i}
								className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
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
				<div
					onClick={() => router.push("/dashboard/profile")}
					className="p-3 w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
				>
					<Icon name="Profile" size={22} />
				</div>
			</aside>

			{/* Main content */}
			<main className="flex flex-1 justify-center items-center px-4">
				<div className="bg-white rounded-lg shadow-xl p-10 w-full max-w-md">
					<h1 className="text-3xl font-semibold text-gray-900 mb-2 text-center">
						Welcome back to Mira
					</h1>
					<p className="text-gray-500 text-center mb-6">
						You don’t have an account?{" "}
						<a
							href="/signup"
							className="underline text-purple-500 hover:text-purple-600"
						>
							Sign up
						</a>
					</p>

					<form className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-600 mb-1">
								Email
							</label>
							<input
								type="email"
								className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
								placeholder="you@example.com"
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
							/>
						</div>

						<button
							type="button"
							onClick={() => router.push("/")}
							className="w-full bg-black text-white py-2.5 rounded-full font-medium hover:opacity-90 transition"
						>
							Log in
						</button>
					</form>

					<p className="text-sm text-center mt-3 text-gray-500 hover:text-gray-700 cursor-pointer">
						Forgot your password?
					</p>

					<div className="flex items-center gap-2 my-6">
						<div className="h-[1px] flex-1 bg-gray-200"></div>
						<span className="text-gray-400 text-sm">Or continue with</span>
						<div className="h-[1px] flex-1 bg-gray-200"></div>
					</div>

					<div className="space-y-3">
						<button className="w-full border border-gray-300 flex items-center justify-center gap-3 py-2 rounded-full hover:bg-gray-50 transition">
							<FcGoogle size={20} />
							<span className="font-medium text-gray-700">
								Log in with Google
							</span>
						</button>

						<button className="w-full bg-black text-white flex items-center justify-center gap-3 py-2 rounded-full hover:opacity-90 transition">
							<FaApple size={20} />
							<span className="font-medium">Log in with Apple</span>
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
