/** @format */
"use client";

import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useRouter } from "next/navigation";
// import { Icon } from "@/components/Icon";
import { useState, useEffect } from "react";
import { isAuthenticated, storeRefreshToken } from "@/utils/auth";
import { supabase } from "@/utils/supabaseClient";

export default function LoginPage() {
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


	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		console.log("Login attempt:", { email, password });
		setLoading(true);
		try {
			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");
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

			// Store the access token
			localStorage.setItem("access_token", data.access_token);
			
			// Store refresh token if available
			if (data.refresh_token) {
				storeRefreshToken(data.refresh_token);
			}
			
			// Store user profile data from signin response
			const userEmail = data.user_email || email;
			localStorage.setItem("mira_email", userEmail);
			localStorage.setItem("mira_provider", "email");
			
			console.log("Login: Stored user data:", { email: userEmail, provider: "email" });
			
			// Dispatch custom event to notify ProfileMenu component
			window.dispatchEvent(new CustomEvent('userDataUpdated'));
			
			// Try to fetch additional user profile information from Supabase (prioritize updated data)
			try {
				// First get /me response
				const userRes = await fetch(`${apiBase}/me`, {
					headers: {
						"Authorization": `Bearer ${data.access_token}`,
						"Content-Type": "application/json"
					}
				});
				
				let fullName = null;
				let picture = null;
				
				if (userRes.ok) {
					const userData = await userRes.json();
					
					// Try to get name from user_profile table first (most reliable)
					try {
						const profileRes = await fetch(`${apiBase}/user_settings`, {
							headers: {
								"Authorization": `Bearer ${data.access_token}`,
								"Content-Type": "application/json"
							},
							credentials: 'include' // Include cookies (needed for ms_access_token cookie)
						});
						
						if (profileRes.ok) {
							const profileResult = await profileRes.json();
							if (profileResult?.status === 'success' && profileResult?.data) {
								const profileData = profileResult.data;
								if (profileData.firstName || profileData.lastName) {
									fullName = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ');
								}
								if (profileData.profilePicture) {
									picture = profileData.profilePicture;
								}
							}
						}
					} catch (err) {
						console.log("Could not fetch user_profile, using fallback:", err);
					}
					
					// Fallback to user_metadata if user_profile doesn't have name
					if (!fullName && userData.user_metadata?.full_name) {
						fullName = userData.user_metadata.full_name;
					} else if (!fullName && userData.user_metadata?.given_name && userData.user_metadata?.family_name) {
						fullName = `${userData.user_metadata.given_name} ${userData.user_metadata.family_name}`;
					}
					
					// Fallback to user_metadata for picture
					if (!picture && userData.user_metadata?.avatar_url) {
						picture = userData.user_metadata.avatar_url;
					}
					
					// Store what we found
					if (fullName) {
						localStorage.setItem("mira_full_name", fullName);
					}
					if (picture) {
						localStorage.setItem("mira_profile_picture", picture);
					}
					
					console.log("Login: Fetched and stored profile data:", {
						fullName: fullName,
						avatar: picture
					});
				}
			} catch (error) {
				// Continue without additional profile data
				console.log("Could not fetch additional profile data:", error);
			}
			
			// Dispatch event again after fetching additional data
			window.dispatchEvent(new CustomEvent('userDataUpdated'));
			
			// Check onboarding status before redirecting
			try {
				console.log("Checking onboarding status for email:", userEmail);
				const onboardingRes = await fetch(`${apiBase}/onboarding_status?email=${encodeURIComponent(userEmail)}`, {
					headers: {
						"Authorization": `Bearer ${data.access_token}`,
						"Content-Type": "application/json"
					}
				});
				
				console.log("Onboarding status response:", onboardingRes.status, onboardingRes.statusText);
				
				if (onboardingRes.ok) {
					const onboardingData = await onboardingRes.json();
					const onboarded = !!onboardingData?.onboarded;
					console.log("Onboarding status data:", onboardingData);
					console.log("User onboarded:", onboarded);
					
					if (!onboarded) {
						console.log("User not onboarded, redirecting to onboarding");
						router.push("/onboarding/step1");
					} else {
						console.log("User onboarded, redirecting to home");
						router.push("/");
					}
				} else {
					const errorText = await onboardingRes.text();
					console.log("Onboarding status check failed:", onboardingRes.status, errorText);
					console.log("Could not check onboarding status, redirecting to home");
					router.push("/");
				}
			} catch (error) {
				console.log("Error checking onboarding status:", error);
				router.push("/");
			}
		} catch {
			alert("Login failed. Please check your credentials.");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleLogin = async () => {
		console.log("Google login clicked");
		try {
            const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: `${window.location.origin}/auth/callback`
				}
			});
			
			if (error) {
				console.error("Google OAuth error:", error);
				alert("Google login failed. Please try again.");
			}
		} catch (err) {
			console.error("Error during Google login:", err);
			alert("Something went wrong with Google login. Please try again.");
		}
	};

	return (
		<div className="flex flex-col md:flex-row h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8] text-gray-800">
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
						<button
							onClick={handleGoogleLogin}
							className="w-full border border-gray-300 flex items-center justify-center gap-3 py-2 rounded-full hover:bg-gray-50 transition text-sm sm:text-base"
						>
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

		</div>
	);
}
