/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTokenFromUrl, storeAuthToken } from "@/utils/auth";

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