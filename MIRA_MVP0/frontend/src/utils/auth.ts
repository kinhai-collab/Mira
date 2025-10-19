// Utility functions for authentication

export interface UserData {
	email: string;
	fullName?: string;
	firstName?: string;
	lastName?: string;
	picture?: string;
	provider?: string;
}

export function extractTokenFromUrl(): string | null {
	if (typeof window === 'undefined') return null;
	
	const hash = window.location.hash;
	if (!hash) return null;
	
	const params = new URLSearchParams(hash.substring(1)); // Remove the # character
	return params.get("access_token");
}

export function extractUserDataFromToken(token: string): UserData | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		
		const userData: UserData = {
			email: payload.email || '',
		};

		// Extract Google OAuth data
		if (payload.user_metadata) {
			userData.fullName = payload.user_metadata.full_name || payload.user_metadata.name;
			userData.picture = payload.user_metadata.avatar_url || payload.user_metadata.picture;
			userData.provider = 'google';
		}

		// Extract app metadata
		if (payload.app_metadata?.provider) {
			userData.provider = payload.app_metadata.provider;
		}

		// If no full name from metadata, try to construct from email
		if (!userData.fullName && userData.email) {
			const emailPrefix = userData.email.split('@')[0];
			userData.fullName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
		}

		return userData;
	} catch (e) {
		console.log("Could not extract user data from token:", e);
		return null;
	}
}

export function storeAuthToken(token: string): void {
	if (typeof window === 'undefined') return;
	
	localStorage.setItem("access_token", token);
	
	// Extract and store user data
	const userData = extractUserDataFromToken(token);
	if (userData) {
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
	}
}

export function getStoredToken(): string | null {
	if (typeof window === 'undefined') return null;
	
	return localStorage.getItem("access_token") ?? localStorage.getItem("token");
}

export function getStoredUserData(): UserData | null {
	if (typeof window === 'undefined') return null;
	
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
	if (typeof window === 'undefined') return;
	
	localStorage.removeItem("access_token");
	localStorage.removeItem("token");
	localStorage.removeItem("mira_email");
	localStorage.removeItem("mira_full_name");
	localStorage.removeItem("mira_profile_picture");
	localStorage.removeItem("mira_provider");
}

export function isAuthenticated(): boolean {
	if (typeof window === 'undefined') return false;
	
	const token = getStoredToken();
	return !!token;
}

export function requireAuth(router: any, redirectTo: string = '/login'): boolean {
	if (!isAuthenticated()) {
		router.push(redirectTo);
		return false;
	}
	return true;
}
