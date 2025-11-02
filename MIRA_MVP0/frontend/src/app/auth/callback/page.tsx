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

      // 2) FIRST: Get the latest user data from Supabase (source of truth)
      // This ensures we use the updated profile information saved via profile_update
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
      
      console.log("Auth callback: /me response from Supabase:", me);
      console.log("Auth callback: user_metadata from Supabase:", me?.user_metadata);
      
      // 3) Get user profile data from user_profile table (source of truth for name)
      let profileData = null;
      try {
        const profileRes = await fetch(`${apiBase}/user_settings`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include' // Include cookies (needed for ms_access_token cookie)
        });
        if (profileRes.ok) {
          const profileResult = await profileRes.json();
          if (profileResult?.status === 'success' && profileResult?.data) {
            profileData = profileResult.data;
            console.log("Auth callback: user_profile data:", profileData);
          }
        }
      } catch (err) {
        console.log("Auth callback: Could not fetch user_profile, continuing...", err);
      }
      
      // 4) Extract user data from token as fallback (Google's original data)
      let tokenUserData = extractUserDataFromToken(accessToken);
      console.log("Auth callback: token user data:", tokenUserData);
      
      // 5) Build userData with priority: user_profile > user_metadata > token data
      let userData: any = null;
      
      // Construct full name from user_profile table (most reliable source)
      let fullName = null;
      if (profileData?.firstName || profileData?.lastName) {
        fullName = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ');
      }
      
      // If no name from user_profile, try user_metadata from /me
      if (!fullName && me?.user_metadata) {
        fullName = me.user_metadata.full_name || 
                   me.user_metadata.name || 
                   me.user_metadata.display_name ||
                   (me.user_metadata.given_name && me.user_metadata.family_name ? 
                    `${me.user_metadata.given_name} ${me.user_metadata.family_name}` : null);
      }
      
      // Last resort: use token data
      if (!fullName && tokenUserData?.fullName) {
        fullName = tokenUserData.fullName;
      }
      
      // Get picture with same priority
      let picture = null;
      if (profileData?.profilePicture) {
        picture = profileData.profilePicture;
      } else if (me?.user_metadata) {
        picture = me.user_metadata.avatar_url || 
                  me.user_metadata.picture || 
                  me.user_metadata.photo_url ||
                  me.avatar_url;
      } else if (tokenUserData?.picture) {
        picture = tokenUserData.picture;
      }
      
      userData = {
        email: me.email || email || '',
        fullName: fullName,
        picture: picture,
        provider: me.app_metadata?.provider || 
                 me.user_metadata?.provider || 
                 tokenUserData?.provider || 
                 'google'
      };
      
      console.log("Auth callback: Final userData being stored:", userData);
      
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
      console.log("Checking onboarding status for email:", email);
      const statusRes = await fetch(`${apiBase}/onboarding_status?email=${encodeURIComponent(email || "")}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log("Onboarding status response:", statusRes.status, statusRes.statusText);
      const statusJson = await statusRes.json();
      console.log("Onboarding status data:", statusJson);
      const onboarded = !!statusJson?.onboarded;
      console.log("User onboarded:", onboarded);

      // 5) Route: first-time (no onboarding row) -> onboarding/step1, else -> home page
      if (!onboarded) {
        setStatus("Welcome! Let's complete your onboarding...");
        router.replace("/onboarding/step1");
      } else {
        setStatus("Welcome back. Redirecting to home...");
        router.replace("/");
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
