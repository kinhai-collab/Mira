/** @format */

/**
 * Normalizes a WebSocket URL to use the secure protocol (wss://) when the page is loaded over HTTPS.
 * This prevents mixed content errors when trying to connect to insecure WebSocket endpoints
 * from secure pages.
 *
 * @param wsUrl - The WebSocket URL (e.g., 'ws://example.com' or 'wss://example.com')
 * @returns The normalized WebSocket URL
 */
export function normalizeWebSocketUrl(wsUrl: string): string {
	if (!wsUrl) {
		return wsUrl;
	}

	// Check if the current page is loaded over HTTPS
	const isSecureContext =
		typeof window !== "undefined" && window.location.protocol === "https:";

	// If page is secure and URL uses ws://, convert to wss://
	if (isSecureContext && wsUrl.startsWith("ws://")) {
		return wsUrl.replace(/^ws:\/\//, "wss://");
	}

	// Otherwise, return the URL as-is
	return wsUrl;
}

/**
 * Gets the WebSocket URL from environment variables or default, with protocol normalization.
 * Automatically appends the WebSocket endpoint path if the URL doesn't already have a path.
 * This is the recommended way to get WebSocket URLs in the application.
 *
 * @param defaultUrl - Default WebSocket URL to use if NEXT_PUBLIC_WS_URL is not set
 * @returns The normalized WebSocket URL with the correct endpoint path
 */
export function getWebSocketUrl(
	defaultUrl: string = "ws://127.0.0.1:8000/api/ws/voice-stt"
): string {
	const envUrl =
		typeof process !== "undefined" &&
		process.env &&
		process.env.NEXT_PUBLIC_WS_URL
			? (process.env.NEXT_PUBLIC_WS_URL as string)
			: null;

	let wsUrl = envUrl || defaultUrl;
	
	// Normalize protocol first
	wsUrl = normalizeWebSocketUrl(wsUrl);
	
	// If the URL doesn't have a path (just domain), append the WebSocket endpoint
	// Check if URL is just a domain (no path after the port, or ends with /)
	try {
		const urlObj = new URL(wsUrl);
		// If pathname is empty or just "/", append the WebSocket endpoint
		if (!urlObj.pathname || urlObj.pathname === "/") {
			wsUrl = wsUrl.replace(/\/$/, "") + "/api/ws/voice-stt";
		}
		// If pathname doesn't end with the WebSocket endpoint, check if it's incomplete
		else if (!urlObj.pathname.endsWith("/api/ws/voice-stt") && !urlObj.pathname.endsWith("/ws/voice-stt")) {
			// Only append if the URL looks like a base URL (ends with common patterns)
			if (/^\/?$/.test(urlObj.pathname) || urlObj.pathname === "/api" || urlObj.pathname.endsWith("/api/")) {
				wsUrl = wsUrl.replace(/\/$/, "") + "/api/ws/voice-stt";
			}
		}
	} catch (e) {
		// If URL parsing fails, try simple string matching
		// Check if URL ends with domain (no path or just /)
		if (wsUrl.match(/^wss?:\/\/[^\/]+\/?$/)) {
			wsUrl = wsUrl.replace(/\/$/, "") + "/api/ws/voice-stt";
		} else {
			console.warn("Failed to parse WebSocket URL:", wsUrl, e);
		}
	}
	
	return wsUrl;
}

