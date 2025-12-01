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
 * This is the recommended way to get WebSocket URLs in the application.
 *
 * @param defaultUrl - Default WebSocket URL to use if NEXT_PUBLIC_WS_URL is not set
 * @returns The normalized WebSocket URL
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

	const wsUrl = envUrl || defaultUrl;
	return normalizeWebSocketUrl(wsUrl);
}

