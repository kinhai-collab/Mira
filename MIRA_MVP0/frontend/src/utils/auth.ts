/** @format */

// Utility functions for authentication

import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export interface UserData {
	email: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	picture?: string;
	provider?: string;
}

export function extractTokenFromUrl(): string | null {
	if (typeof window === "undefined") return null;

	const hash = window.location.hash;
	if (!hash) return null;

	const params = new URLSearchParams(hash.substring(1)); // Remove the # character
	return params.get("access_token");
}

export function extractUserDataFromToken(token: string): UserData | null {
	try {
		console.log("Extracting user data from token...");
		console.log("Token length:", token.length);
		console.log("Token starts with:", token.substring(0, 50));

		// Check if token is a JWT (has dots)
		if (!token.includes(".")) {
			console.log("Token is not a JWT format, skipping extraction");
			return null;
		}

		const parts = token.split(".");
		if (parts.length !== 3) {
			console.log("Token doesn't have 3 parts, invalid JWT format");
			return null;
		}

		const payload = JSON.parse(atob(parts[1]));
		console.log("Token payload:", payload);

		const userData: UserData = {
			email: payload.email || "",
		};

		// Extract Google OAuth data from user_metadata
		if (payload.user_metadata) {
			console.log("User metadata found:", payload.user_metadata);
			userData.fullName =
				payload.user_metadata.full_name ||
				payload.user_metadata.name ||
				payload.user_metadata.display_name ||
				(payload.user_metadata.given_name && payload.user_metadata.family_name
					? `${payload.user_metadata.given_name} ${payload.user_metadata.family_name}`
					: null);
			userData.picture =
				payload.user_metadata.avatar_url ||
				payload.user_metadata.picture ||
				payload.user_metadata.photo_url;
			userData.provider = payload.user_metadata.provider || "google";
		}

		// Extract app metadata
		if (payload.app_metadata?.provider) {
			userData.provider = payload.app_metadata.provider;
		}

		// Extract additional data from the main payload
		if (payload.name && !userData.fullName) {
			userData.fullName = payload.name;
		}
		if (payload.picture && !userData.picture) {
			userData.picture = payload.picture;
		}
		if (payload.given_name && payload.family_name && !userData.fullName) {
			userData.fullName = `${payload.given_name} ${payload.family_name}`;
		}

		// If no full name from metadata, try to construct from email
		if (!userData.fullName && userData.email) {
			const emailPrefix = userData.email.split("@")[0];
			userData.fullName =
				emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
		}

		console.log("Final extracted user data:", userData);
		return userData;
	} catch (e) {
		console.error("Could not extract user data from token:", e);
		console.error("Token was:", token.substring(0, 100));
		return null;
	}
}

export function storeAuthToken(token: string): void {
	if (typeof window === "undefined") return;

	console.log("Storing auth token:", token.substring(0, 20) + "...");
	localStorage.setItem("access_token", token);

	// NOTE: Do NOT store user data extracted from token here
	// Token contains stale user metadata that will be overwritten
	// Let the caller fetch fresh data from Supabase /me endpoint
	console.log("Token stored. Caller should fetch fresh user data from Supabase.");
}

export function getStoredToken(): string | null {
	if (typeof window === "undefined") return null;

	return localStorage.getItem("access_token") ?? localStorage.getItem("token");
}

export function getStoredRefreshToken(): string | null {
	if (typeof window === "undefined") return null;

	return localStorage.getItem("refresh_token");
}

export function storeRefreshToken(token: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem("refresh_token", token);
}

export function isTokenExpired(token: string | null): boolean {
	if (!token) return true;
	
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return true;
		
		const payload = JSON.parse(atob(parts[1]));
		const exp = payload.exp;
		
		if (!exp) return false; // If no expiration, assume it's valid
		
		// Check if token expires in less than 60 seconds (buffer time)
		return Date.now() >= (exp * 1000) - 60000;
	} catch {
		return true; // If we can't parse, assume expired
	}
}

export async function refreshAccessToken(): Promise<string | null> {
	const refreshToken = getStoredRefreshToken();
	if (!refreshToken) {
		console.error("No refresh token available");
		return null;
	}

	try {
		const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
		const response = await fetch(`${apiBase}/refresh_token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (!response.ok) {
			console.error("Failed to refresh token");
			return null;
		}

		const data = await response.json();
		const newAccessToken = data.access_token;
		const newRefreshToken = data.refresh_token;

		if (newAccessToken) {
			localStorage.setItem("access_token", newAccessToken);
			if (newRefreshToken) {
				localStorage.setItem("refresh_token", newRefreshToken);
			}
			return newAccessToken;
		}

		return null;
	} catch (error) {
		console.error("Error refreshing token:", error);
		return null;
	}
}

export async function getValidToken(): Promise<string | null> {
	let token = getStoredToken();
	
	if (!token || isTokenExpired(token)) {
		console.log("Token expired or missing, attempting to refresh...");
		token = await refreshAccessToken();
		
		if (!token) {
			console.error("Failed to refresh token, user needs to log in again");
			return null;
		}
	}
	
	return token;
}

export function getStoredUserData(): UserData | null {
	if (typeof window === "undefined") return null;

	const email = localStorage.getItem("mira_email");
	if (!email) return null;

	const userData: UserData = { email };

	const fullName = localStorage.getItem("mira_full_name");
	if (fullName) userData.fullName = fullName;

	const picture = localStorage.getItem("mira_profile_picture");
	if (picture) userData.picture = picture;

	const provider = localStorage.getItem("mira_provider");
	if (provider) userData.provider = provider;

	return userData;
}

export function clearAuthTokens(): void {
	if (typeof window === "undefined") return;

	console.log("Clearing all auth tokens and user data...");

	// Clear all authentication tokens
	localStorage.removeItem("access_token");
	localStorage.removeItem("token");

	// Clear all user data
	localStorage.removeItem("mira_email");
	localStorage.removeItem("mira_full_name");
	localStorage.removeItem("mira_profile_picture");
	localStorage.removeItem("mira_provider");

	// Clear any additional OAuth data that might be stored
	localStorage.removeItem("mira_first_name");
	localStorage.removeItem("mira_last_name");

	console.log("All auth data cleared from localStorage");
}

export function isAuthenticated(): boolean {
	if (typeof window === "undefined") return false;

	const token = getStoredToken();
	return !!token;
}

export function requireAuth(
	router: AppRouterInstance,
	redirectTo: string = "/login"
): boolean {
	if (!isAuthenticated()) {
		router.push(redirectTo);
		return false;
	}
	return true;
}

export async function refreshUserData(): Promise<UserData | null> {
	const token = getStoredToken();
	if (!token) return null;

	try {
		const apiBase = (
			process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
		).replace(/\/+$/, "");
		const response = await fetch(`${apiBase}/me`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!response.ok) return null;

		const me = await response.json();
		
		// Try to get data from user_profile table first (most reliable)
		let fullName = null;
		let picture = null;
		
		try {
			const profileRes = await fetch(`${apiBase}/user_settings`, {
				headers: { Authorization: `Bearer ${token}` },
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
			console.log("Could not fetch user_profile in refreshUserData, using fallback:", err);
		}
		
		// Fallback to user_metadata if user_profile doesn't have data
		if (!fullName) {
			fullName =
				me.user_metadata?.full_name ||
				me.user_metadata?.name ||
				me.user_metadata?.display_name ||
				(me.user_metadata?.given_name && me.user_metadata?.family_name
					? `${me.user_metadata.given_name} ${me.user_metadata.family_name}`
					: null);
		}
		
		if (!picture) {
			picture =
				me.user_metadata?.avatar_url ||
				me.user_metadata?.picture ||
				me.user_metadata?.photo_url ||
				me.avatar_url;
		}
		
		const userData: UserData = {
			email: me.email || "",
			fullName: fullName,
			picture: picture,
			provider: me.app_metadata?.provider || "google",
		};

		// Update localStorage with fresh data
		if (userData.email) {
			localStorage.setItem("mira_email", userData.email);
			if (userData.fullName) {
				localStorage.setItem("mira_full_name", userData.fullName);
			}
			if (userData.picture) {
				localStorage.setItem("mira_profile_picture", userData.picture);
			}
			if (userData.provider) {
				localStorage.setItem("mira_provider", userData.provider);
			}

			// Dispatch event to notify components
			window.dispatchEvent(new CustomEvent("userDataUpdated"));
		}

		return userData;
	} catch (error) {
		console.error("Failed to refresh user data:", error);
		return null;
	}
}
