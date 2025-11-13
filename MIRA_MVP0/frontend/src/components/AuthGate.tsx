"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
	isAuthenticated,
	getValidToken,
	getStoredToken,
	clearAuthTokens,
} from "@/utils/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
	// Public routes that should not be forced to landing
	const publicPaths = [
		"/landing",
		"/login",
		"/signup",
		"/auth/callback",
		"/onboarding",
		"/onboarding/step1",
		"/onboarding/step2",
		"/signup/complete",
		"/signup/success",
		"/signup/verify",
	];

	const pathname = usePathname();
	const router = useRouter();

	const [ready, setReady] = useState(false);
	const [authed, setAuthed] = useState<boolean | null>(null);

	useEffect(() => {
		if (!pathname) return;
		if (typeof window === "undefined") return;

		const inactivityTimeoutMinutes =
			Number(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MINUTES) || 1440; // default 24h
		const inactivityTimeoutMs = inactivityTimeoutMinutes * 60 * 1000;
		const now = Date.now();

		try {
			const lastVisitRaw = localStorage.getItem("mira_last_visit");
			if (lastVisitRaw) {
				const lastVisit = Number(lastVisitRaw);
				if (!Number.isNaN(lastVisit) && now - lastVisit > inactivityTimeoutMs) {
					if (process.env.NODE_ENV !== "production") {
						console.debug("AuthGate detected long inactivity. Clearing session.");
					}
					clearAuthTokens();
					localStorage.removeItem("mira_first_visit");
				}
			}
		} catch (error) {
			console.warn("AuthGate could not evaluate inactivity timeout:", error);
		}

		try {
			localStorage.setItem("mira_last_visit", String(now));
		} catch (error) {
			console.warn("AuthGate could not update last visit timestamp:", error);
		}

		// quick synchronous check first (fast UI response)
		const quick = isAuthenticated();

		// DEV: log quick check
		if (process.env.NODE_ENV !== "production") {
			console.debug("AuthGate quick check", { pathname, quick });
		}
		if (quick) {
			setAuthed(true);
			setReady(true);
		}

		// Try to verify/refresh token before deciding to redirect
		(async () => {
			try {
				const token = await getValidToken();
				if (process.env.NODE_ENV !== "production") {
					console.debug("AuthGate getValidToken result", {
						hasToken: !!token,
						storedTokenPresent: !!getStoredToken(),
					});
				}
				if (token) {
					setAuthed(true);
				} else {
					// No valid token found — fallback to checking stored token (maybe expired)
					const stored = getStoredToken();
					setAuthed(!!stored ? true : false);
				}
			} catch (e) {
				if (process.env.NODE_ENV !== "production") {
					console.debug("AuthGate getValidToken threw", e);
				}
				setAuthed(false);
			} finally {
				setReady(true);
			}
		})();
	}, [pathname]);

	useEffect(() => {
		if (!ready || authed === null) return;

		// Guard: first visit should still show landing for unauthenticated users
		const firstVisit = localStorage.getItem("mira_first_visit");

		if (!firstVisit) {
			localStorage.setItem("mira_first_visit", "1");
			if (!authed && !pathname.startsWith("/landing")) {
				router.push("/landing");
			}
			return;
		}

		const isPublic = publicPaths.some((p) => pathname.startsWith(p));
		if (!authed && !isPublic) {
			router.push("/landing");
			return;
		}

		if (authed && pathname === "/landing") {
			router.push("/");
		}
	}, [ready, authed, pathname, router, publicPaths]);

	// While we're determining auth state, don't render children to avoid flashing protected UI
	if (!ready) {
		return null;
	}

	// If user is not authenticated and current path is not public, don't render children
	const isPublicNow = publicPaths.some((p) => pathname?.startsWith(p));
	if (!authed && !isPublicNow) {
		// router.push will run in effect; return null to avoid showing protected UI briefly
		return null;
	}

	// If user is authenticated but currently on landing, don't render children while redirecting
	if (authed && pathname === "/landing") {
		return null;
	}

	return <>{children}</>;
}
