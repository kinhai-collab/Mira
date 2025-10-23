/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTokenFromUrl, storeAuthToken, extractUserDataFromToken } from "@/utils/auth";

export default function AuthCallback() {
	const router = useRouter();
	const [status, setStatus] = useState("Processing authentication...");

	useEffect(() => {
  const handleAuthCallback = async () => {
    try {
      // 1) Grab token from URL fragment and persist it
      const accessToken = extractTokenFromUrl();
      if (!accessToken) {
        setStatus("No access token found. Redirecting to login...");
        setTimeout(() => router.push("/login"), 1500);
        return;
      }
      storeAuthToken(accessToken);

      // 2) Extract user data from token and store it
      let userData = extractUserDataFromToken(accessToken);
      
      // 3) Ask backend who this is (email) for additional verification
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
      const meRes = await fetch(`${apiBase}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        setStatus("Failed to fetch user profile. Redirecting to login...");
        setTimeout(() => router.push("/login"), 1500);
        return;
      }
      const me = await meRes.json();
      const email = me?.email;
      
      // If token extraction failed, try to get user data from backend response
      if (!userData && me) {
        console.log("Token extraction failed, using backend data:", me);
        userData = {
          email: me.email || '',
          fullName: me.user_metadata?.full_name || 
                   me.user_metadata?.name || 
                   me.user_metadata?.display_name ||
                   (me.user_metadata?.given_name && me.user_metadata?.family_name ? 
                    `${me.user_metadata.given_name} ${me.user_metadata.family_name}` : null),
          picture: me.user_metadata?.avatar_url || 
                  me.user_metadata?.picture || 
                  me.user_metadata?.photo_url ||
                  me.avatar_url,
          provider: me.app_metadata?.provider || 'google'
        };
      }
      
      // Store user data if we have any
      if (userData && userData.email) {
        try {
          localStorage.setItem("mira_email", userData.email);
          localStorage.setItem("mira_provider", userData.provider || "google");
          if (userData.fullName) {
            localStorage.setItem("mira_full_name", userData.fullName);
          }
          if (userData.picture) {
            localStorage.setItem("mira_profile_picture", userData.picture);
          }
          console.log("Stored user data:", userData);
          
          // Dispatch event to notify ProfileMenu component
          window.dispatchEvent(new CustomEvent('userDataUpdated'));
        } catch (error) {
          console.error("Failed to store user data:", error);
        }
      }

      // 4) Check onboarding status
      const statusRes = await fetch(`${apiBase}/onboarding_status?email=${encodeURIComponent(email || "")}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const statusJson = await statusRes.json();
      const onboarded = !!statusJson?.onboarded;

      // 5) Route: first-time (no onboarding row) -> onboarding/step1, else -> dashboard
      if (!onboarded) {
        setStatus("Welcome! Let’s complete your onboarding...");
        router.replace("/onboarding/step1");
      } else {
        setStatus("Welcome back. Redirecting to dashboard...");
        router.replace("/dashboard");
      }
    } catch (err) {
      console.error("Error during authentication callback:", err);
      setStatus("Authentication failed. Redirecting to login...");
      setTimeout(() => router.push("/login"), 1500);
    }
  };

  handleAuthCallback();
}, [router]);

	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#D9B8FF] via-[#E8C9F8] to-[#F6D7F8]">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
				<p className="text-gray-600">{status}</p>
			</div>
		</div>
	);
}
