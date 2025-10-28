/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTokenFromUrl, storeAuthToken, extractUserDataFromToken } from "@/utils/auth";

// ✅ NEW: read Supabase session (contains Google provider tokens)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

        // --- Path A: Supabase Google OAuth ---
        // If user just returned from Google OAuth, Supabase will have a session.
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const provider = (session.user?.app_metadata as any)?.provider;
          const supaEmail = session.user?.email ?? session.user?.user_metadata?.email ?? null;

          // Supabase exposes Google tokens on the session:
          // - session.provider_token (short-lived Google access token)
          // - (session as any).provider_refresh_token (long-lived refresh token; only on first consent)
          const providerAccessToken = (session as any)?.provider_token as string | undefined;
          const providerRefreshToken = (session as any)?.provider_refresh_token as string | undefined;

          // Save who the user is for the UI
          try {
            if (supaEmail) localStorage.setItem("mira_email", supaEmail);
            localStorage.setItem("mira_provider", provider || "google");
            if (session.user?.user_metadata?.full_name) {
              localStorage.setItem("mira_full_name", session.user.user_metadata.full_name);
            }
            if (session.user?.user_metadata?.avatar_url) {
              localStorage.setItem("mira_profile_picture", session.user.user_metadata.avatar_url);
            }
          } catch {}

          // If we got Google tokens, forward them to backend to store securely
          if (providerAccessToken) {
            try {
              await fetch(`${apiBase}/oauth/google/store`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_id: session.user.id,
                  access_token: providerAccessToken,
                  refresh_token: providerRefreshToken ?? null,
                  scope: (session as any)?.scope ?? null,
                  expires_in: 3500, // approx; Google access tokens ~1h
                }),
              });
            } catch (err) {
              console.warn("Could not store Google tokens on backend:", err);
              // continue anyway; user can still proceed
            }
          }

          // Use Supabase knowledge of the user for onboarding decision
          const emailForOnboarding = supaEmail || "";
          try {
            const statusRes = await fetch(
              `${apiBase}/onboarding_status?email=${encodeURIComponent(emailForOnboarding)}`
            );
            const statusJson = await statusRes.json();
            const onboarded = !!statusJson?.onboarded;

            if (!onboarded) {
              setStatus("Welcome! Let’s complete your onboarding...");
              router.replace("/onboarding/step1");
            } else {
              setStatus("Welcome back. Redirecting to dashboard...");
              router.replace("/dashboard");
            }
            return; // ✅ Done with Path A
          } catch {
            // If onboarding check fails, still route to dashboard as fallback
            router.replace("/dashboard");
            return;
          }
        }

        // --- Path B: Backward compatibility with your old flow ---
        // Your previous implementation expected an access token in the URL fragment.
        const accessToken = extractTokenFromUrl();
        if (!accessToken) {
          setStatus("No session found. Redirecting to login...");
          setTimeout(() => router.push("/login"), 1500);
          return;
        }
        storeAuthToken(accessToken);

        // Ask backend who this is (email)
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
        if (email) {
          try {
            localStorage.setItem("mira_email", email);
            localStorage.setItem("mira_provider", "google");
          } catch {}
        }

        // Check onboarding status
        const statusRes = await fetch(
          `${apiBase}/onboarding_status?email=${encodeURIComponent(email || "")}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const statusJson = await statusRes.json();
        const onboarded = !!statusJson?.onboarded;

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

<<<<<<< HEAD
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
=======
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
>>>>>>> c582cd3d3464c1e02ff8e0c14569c81bb9c54466
