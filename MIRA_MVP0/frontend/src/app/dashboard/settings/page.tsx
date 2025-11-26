/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getStoredUserData, UserData, getValidToken } from "@/utils/auth";
import { ChevronDown, Sun, MapPin, Bell, Check } from "lucide-react";
import { getWeather } from "@/utils/weather";
import Sidebar from "@/components/Sidebar";

// Custom Checkbox Component (Square for Notifications)
const CustomCheckbox = ({
	checked,
	onChange,
	className = "",
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	className?: string;
}) => (
	<div className={`relative w-5 h-5 ${className}`}>
		<div
			className={`absolute inset-0 border-2 border-gray-400 rounded ${
				checked ? "bg-gray-400 border-gray-400" : "bg-transparent"
			}`}
		/>
		{checked && (
			<div className="absolute inset-0 flex items-center justify-center">
				<Check className="w-3 h-3 text-white" strokeWidth={3} />
			</div>
		)}
		<input
			type="checkbox"
			checked={checked}
			onChange={(e) => onChange(e.target.checked)}
			className="absolute inset-0 opacity-0 cursor-pointer"
		/>
	</div>
);

// Custom Circular Checkbox Component (for Privacy Settings)
const CustomCircularCheckbox = ({
	checked,
	onChange,
	className = "",
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	className?: string;
}) => (
	<div className={`relative w-5 h-5 ${className}`}>
		<div
			className={`absolute inset-0 border-2 border-gray-400 rounded-full ${
				checked ? "bg-gray-400 border-gray-400" : "bg-transparent"
			}`}
		/>
		{checked && (
			<div className="absolute inset-0 flex items-center justify-center">
				<Check className="w-3 h-3 text-white" strokeWidth={3} />
			</div>
		)}
		<input
			type="checkbox"
			checked={checked}
			onChange={(e) => onChange(e.target.checked)}
			className="absolute inset-0 opacity-0 cursor-pointer"
		/>
	</div>
);

// Custom Radio Button Component (for Subscription Plans)
const CustomRadioButton = ({
	checked,
	onChange,
	name,
	value,
	className = "",
}: {
	checked: boolean;
	onChange: (value: string) => void;
	name: string;
	value: string;
	className?: string;
}) => (
	<div className={`relative w-5 h-5 ${className}`}>
		<div
			className={`absolute inset-0 border-2 border-gray-400 rounded-full ${
				checked ? "bg-gray-400 border-gray-400" : "bg-transparent"
			}`}
		/>
		{checked && (
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="w-2 h-2 bg-white rounded-full"></div>
			</div>
		)}
		<input
			type="radio"
			name={name}
			value={value}
			checked={checked}
			onChange={(e) => onChange(e.target.value)}
			className="absolute inset-0 opacity-0 cursor-pointer"
		/>
	</div>
);

type TabType =
	| "profile"
	| "preferences"
	| "notifications"
	| "privacy"
	| "subscription";

interface OnboardingData {
	step1?: Record<string, unknown>;
	step2?: { firstName?: string; middleName?: string; lastName?: string };
	step3?: { connectedEmails?: string[] };
	step4?: { connectedCalendars?: string[] };
	step5?: { permissions?: Record<string, unknown> };
}

export default function SettingsPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabType>("profile");
	const [userData, setUserData] = useState<UserData | null>(null);
	const [formData, setFormData] = useState({
		email: "",
		firstName: "",
		middleName: "",
		lastName: "",
		language: "English",
		timeZone: "UTC-5 (Eastern Time)",
		voice: "Default",
		pushNotifications: true,
		microphoneAccess: false,
		wakeWordDetection: false,
		emailAccess: true,
		calendarAccess: true,
		selectedPlan: "basic",
		cardName: "",
		cardNumber: "",
		expDate: "",
		cvv: "",
		address: "",
		city: "",
		state: "",
		postalCode: "",
	});
	const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(
		null
	);
	const [connectedEmails, setConnectedEmails] = useState<string[]>([]);
	const [connectedCalendars, setConnectedCalendars] = useState<string[]>([]);

	// Location state (defaults to New York)
	const [location, setLocation] = useState<string>("New York");
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);

	// Timezone for formatting the date/time for the detected location.
	// Default to the browser/system timezone — good offline/frontend-only fallback.
	const [timezone, setTimezone] = useState<string>(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
	);

	// Weather state for settings page
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [temperatureC, setTemperatureC] = useState<number | null>(null);
	const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

	// Check authentication on mount and load user data
	useEffect(() => {
		const loadAllData = async () => {
			// Try to refresh token if expired (for returning users)
			const validToken = await getValidToken();
			if (!validToken) {
				router.push("/login");
				return;
			}
			loadUserData();
			await loadOnboardingData();
			await loadUserSettings();
		};
		loadAllData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router]);

	// Load user data from localStorage
	const loadUserData = () => {
		const storedUserData = getStoredUserData();
		setUserData(storedUserData);
		if (storedUserData) {
			const nameParts = storedUserData.fullName?.split(" ") || [];
			setFormData((prev) => ({
				...prev,
				email: storedUserData.email || "",
				firstName: nameParts[0] || "",
				lastName: nameParts.slice(1).join(" ") || "",
			}));
		}
	};

	// Load onboarding data from backend
	const loadOnboardingData = async () => {
		try {
			const token = await getValidToken();
			if (!token) return;

			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");
			const email = userData?.email || localStorage.getItem("mira_email") || "";

			if (!email) return;

			let response = await fetch(
				`${apiBase}/onboarding_data?email=${encodeURIComponent(email)}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			// If 401, try refreshing token once more
			if (response.status === 401) {
				const refreshedToken = await getValidToken();
				if (refreshedToken && refreshedToken !== token) {
					// Retry with new token
					response = await fetch(
						`${apiBase}/onboarding_data?email=${encodeURIComponent(email)}`,
						{
							headers: {
								Authorization: `Bearer ${refreshedToken}`,
								"Content-Type": "application/json",
							},
						}
					);
				}
			}

			if (response.ok) {
				const data = await response.json();
				if (data.onboarded && data.data) {
					setOnboardingData(data.data);

					// Don't update connected services from onboarding data
					// They should only come from user_profile table via loadUserSettings
					// This prevents onboarding data from overwriting user's saved disconnections

					// Update permissions (only if not already set from user_settings)
					// We prioritize user_settings over onboarding data
					if (
						!formData.pushNotifications &&
						!formData.microphoneAccess &&
						!formData.wakeWordDetection
					) {
						setFormData((prev) => ({
							...prev,
							pushNotifications: data.data.pushNotifications ?? true,
							microphoneAccess: data.data.microphoneAccess ?? false,
							wakeWordDetection: data.data.wakeWordDetection ?? false,
						}));
					}
				}
			}
		} catch (error) {
			console.error("Failed to load onboarding data:", error);
		}
	};

	// Load user settings from user_profile table
	const loadUserSettings = async () => {
		try {
			const token = await getValidToken();
			if (!token) return;

			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");

			let response = await fetch(`${apiBase}/user_settings`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				credentials: "include", // Include cookies (needed for ms_access_token cookie)
			});

			// If 401, try refreshing token once more
			if (response.status === 401) {
				const refreshedToken = await getValidToken();
				if (refreshedToken && refreshedToken !== token) {
					// Retry with new token
					response = await fetch(`${apiBase}/user_settings`, {
						headers: {
							Authorization: `Bearer ${refreshedToken}`,
							"Content-Type": "application/json",
						},
						credentials: "include",
					});
				}
			}

			if (response.ok) {
				const result = await response.json();
				if (result.status === "success" && result.data) {
					const settings = result.data;

					// Restore Gmail credentials from backend to localStorage if they exist
					// This ensures connections persist after logout/login or browser restart
					if (settings.gmail_access_token) {
						localStorage.setItem(
							"gmail_access_token",
							settings.gmail_access_token
						);
						if (settings.gmail_refresh_token) {
							localStorage.setItem(
								"gmail_refresh_token",
								settings.gmail_refresh_token
							);
						}
						if (settings.gmail_email) {
							localStorage.setItem("gmail_email", settings.gmail_email);
						}
						console.log("Gmail credentials restored from backend");
					}

					// Update connected emails and calendars from backend (source of truth)
					if (
						settings.connectedEmails &&
						Array.isArray(settings.connectedEmails)
					) {
						setConnectedEmails(settings.connectedEmails);
					}
					if (
						settings.connectedCalendars &&
						Array.isArray(settings.connectedCalendars)
					) {
						setConnectedCalendars(settings.connectedCalendars);
					}

					// Update profile fields first (so they take priority over localStorage data)
					if (settings.firstName || settings.lastName || settings.middleName) {
						setFormData((prev) => ({
							...prev,
							firstName: settings.firstName || prev.firstName,
							middleName: settings.middleName || prev.middleName,
							lastName: settings.lastName || prev.lastName,
						}));
					}

					// Update preferences
					if (settings.language || settings.time_zone || settings.voice) {
						setFormData((prev) => ({
							...prev,
							language: settings.language || prev.language,
							timeZone: settings.time_zone || prev.timeZone,
							voice: settings.voice || prev.voice,
						}));
					}

					// Update notifications
					if (
						settings.pushNotifications !== undefined ||
						settings.microphoneAccess !== undefined ||
						settings.wakeWordDetection !== undefined
					) {
						setFormData((prev) => ({
							...prev,
							pushNotifications:
								settings.pushNotifications ?? prev.pushNotifications,
							microphoneAccess:
								settings.microphoneAccess ?? prev.microphoneAccess,
							wakeWordDetection:
								settings.wakeWordDetection ?? prev.wakeWordDetection,
						}));
					}

					// Update connected services
					if (settings.connectedEmails) {
						setConnectedEmails(settings.connectedEmails);
					}
					if (settings.connectedCalendars) {
						setConnectedCalendars(settings.connectedCalendars);
					}

					// Update subscription
					if (
						settings.subscriptionPlan ||
						settings.cardName ||
						settings.cardNumber
					) {
						setFormData((prev) => ({
							...prev,
							selectedPlan: settings.subscriptionPlan || prev.selectedPlan,
							cardName: settings.cardName || prev.cardName,
							cardNumber: settings.cardNumber || prev.cardNumber,
							expDate: settings.expDate || prev.expDate,
							cvv: settings.cvv || prev.cvv,
							address: settings.address || prev.address,
							city: settings.city || prev.city,
							state: settings.state || prev.state,
							postalCode: settings.postalCode || prev.postalCode,
						}));
					}
				}
			}
		} catch (error) {
			console.error("Failed to load user settings:", error);
		}
	};

	// Listen for user data updates (from Google OAuth or manual signup/login)
	useEffect(() => {
		const handleUserDataUpdate = async () => {
			console.log("User data updated, reloading...");
			loadUserData();
			await loadOnboardingData();
			await loadUserSettings();
		};

		window.addEventListener("userDataUpdated", handleUserDataUpdate);
		return () =>
			window.removeEventListener("userDataUpdated", handleUserDataUpdate);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Added: get system/geolocation and reverse-geocode to a readable place name
	useEffect(() => {
		// Helper: IP-based fallback when geolocation is unavailable or denied
		const ipFallback = async () => {
			try {
				const res = await fetch("https://ipapi.co/json/");
				if (!res.ok) return;
				const data = await res.json();
				const city =
					data.city || data.region || data.region_code || data.country_name;
				// ipapi returns a `timezone` field like 'America/New_York'
				if (data.timezone) setTimezone(data.timezone);
				if (city) setLocation(city);
				// ipapi returns approximate coords
				if (data.latitude && data.longitude) {
					setLatitude(Number(data.latitude));
					setLongitude(Number(data.longitude));
				}
			} catch (err) {
				console.error("IP geolocation fallback error:", err);
			} finally {
				setIsLocationLoading(false);
			}
		};

		if (!("geolocation" in navigator)) {
			// Browser doesn't support navigator.geolocation — try IP fallback
			ipFallback();
			return;
		}

		const success = async (pos: GeolocationPosition) => {
			try {
				const { latitude, longitude } = pos.coords;
				
				// Use AbortController for timeout
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
				
				try {
					// Use OpenStreetMap Nominatim reverse geocoding (no key required)
					const res = await fetch(
						`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
						{
							headers: {
								"User-Agent": "Mira-PMA/1.0",
							},
							signal: controller.signal,
						}
					);
					clearTimeout(timeoutId);
					
					if (!res.ok) {
						// If reverse geocoding fails, fall back to IP-based lookup
						await ipFallback();
						return;
					}
					const data = await res.json();
					const city =
						data?.address?.city ||
						data?.address?.town ||
						data?.address?.village ||
						data?.address?.state ||
						data?.address?.county;
					if (city) setLocation(city);

					// Keep browser timezone as primary frontend-only source. If you
					// need timezone-from-coordinates, use a server-side timezone API.
					setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

					// Save coordinates for weather lookup
					setLatitude(latitude);
					setLongitude(longitude);
				} catch (fetchErr: any) {
					clearTimeout(timeoutId);
					if (fetchErr.name === "AbortError") {
						console.warn("Nominatim request timed out, using IP fallback");
					} else {
						console.warn("Nominatim fetch failed, using IP fallback:", fetchErr);
					}
					await ipFallback();
				}
			} catch (err) {
				console.error("reverse geocode error:", err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const error = async (err: GeolocationPositionError) => {
			console.error("geolocation error:", err);
			// On permission denied or other errors, try IP-based lookup
			await ipFallback();
		};

		navigator.geolocation.getCurrentPosition(success, error, {
			timeout: 10000,
		});
	}, []);

	// Handle Gmail disconnection
	// Handle OAuth callbacks (Gmail and Outlook) - update local state but don't auto-save
	useEffect(() => {
		const handleOAuthCallback = async () => {
			const urlParams = new URLSearchParams(window.location.search);
			const gmailConnected = urlParams.get("gmail_connected");
			const gmailAccessToken = urlParams.get("access_token");
			const gmailEmail = urlParams.get("email");
			const msConnected = urlParams.get("ms_connected");
			const msEmail = urlParams.get("email");
			const msError = urlParams.get("ms_error");
			const errorMsg = urlParams.get("error_msg");
			const calendarConnected = urlParams.get("calendar");
			const calendarStatus = urlParams.get("status");
			const returnTo = urlParams.get("return_to");

			// Handle Google Calendar callback FIRST (check this before Microsoft to avoid conflicts)
			if (calendarConnected === "google" && calendarStatus === "connected") {
				// Update local state immediately
				setConnectedCalendars((prev) => {
					if (!prev.includes("Google Calendar")) {
						return [...prev, "Google Calendar"];
					}
					return prev;
				});

				// Reload settings from backend to get accurate connection status
				await loadUserSettings();

				// Clear URL parameters before redirect
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);

				// If coming from onboarding, redirect back
				if (returnTo) {
					window.location.href = decodeURIComponent(returnTo);
					return;
				}

				alert(
					`Google Calendar connected successfully! Don't forget to click Save to persist this connection.`
				);
				return;
			}

			// Handle Gmail callback
			if (gmailConnected === "true" && gmailAccessToken && gmailEmail) {
				localStorage.setItem("gmail_access_token", gmailAccessToken);
				localStorage.setItem("gmail_email", gmailEmail);
				// Also save refresh token if available (for persistence)
				const gmailRefreshToken =
					urlParams.get("gmail_refresh_token") ||
					urlParams.get("refresh_token");
				if (gmailRefreshToken) {
					localStorage.setItem("gmail_refresh_token", gmailRefreshToken);
				}

				// ✨ AUTO-SAVE Gmail credentials to backend immediately
				try {
					const apiBase = (
						process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
					).replace(/\/+$/, "");
					const token = await getValidToken();
					if (token) {
						const saveGmailRes = await fetch(
							`${apiBase}/gmail/credentials/save`,
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									gmail_access_token: gmailAccessToken,
									gmail_refresh_token: gmailRefreshToken || "",
								}),
							}
						);

						if (saveGmailRes.ok) {
							console.log("Gmail credentials auto-saved to backend");
						} else {
							console.error("Failed to auto-save Gmail credentials");
						}
					}
				} catch (error) {
					console.error("Error auto-saving Gmail credentials:", error);
					// Continue anyway - user can still use Gmail from localStorage
				}

				// Update local state immediately
				setConnectedEmails((prev) => {
					if (!prev.includes("Gmail")) {
						return [...prev, "Gmail"];
					}
					return prev;
				});

				// Check if calendar scopes were also granted during Gmail OAuth
				const calendarScopeGranted =
					urlParams.get("calendar_scope_granted") === "true";
				if (calendarScopeGranted) {
					// If calendar scopes were granted, also save calendar credentials
					try {
						const apiBase = (
							process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
						).replace(/\/+$/, "");
						const token = await getValidToken();
						if (token) {
							// Call backend to save calendar credentials from Gmail token
							const gmailRefreshToken =
								urlParams.get("gmail_refresh_token") ||
								urlParams.get("refresh_token");
							const saveCalendarRes = await fetch(
								`${apiBase}/gmail/calendar/save-from-gmail`,
								{
									method: "POST",
									headers: {
										Authorization: `Bearer ${token}`,
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										gmail_access_token: gmailAccessToken,
										gmail_refresh_token: gmailRefreshToken,
									}),
								}
							);

							if (saveCalendarRes.ok) {
								// Mark Google Calendar as connected
								setConnectedCalendars((prev) => {
									if (!prev.includes("Google Calendar")) {
										return [...prev, "Google Calendar"];
									}
									return prev;
								});
								console.log("Calendar credentials saved from Gmail OAuth");
							}
						}
					} catch (error) {
						console.error(
							"Error saving calendar credentials from Gmail:",
							error
						);
						// Continue anyway - user can connect calendar separately
					}
				}

				// Reload settings from backend to sync other connection statuses (Outlook, calendars)
				await loadUserSettings();

				// Clear URL parameters before redirect
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);

				// If coming from onboarding, redirect back
				if (returnTo) {
					window.location.href = decodeURIComponent(returnTo);
					return;
				}

				if (calendarScopeGranted) {
					alert(
						`Gmail and Google Calendar connected successfully! Email: ${gmailEmail}`
					);
				} else {
					alert(`Gmail connected successfully! Email: ${gmailEmail}`);
				}
				return;
			}

			// Handle Microsoft/Outlook error callback
			if (msError) {
				const decodedErrorMsg = errorMsg
					? decodeURIComponent(errorMsg)
					: "An error occurred during Microsoft authentication.";

				// Clear URL parameters
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);

				// Show user-friendly error message
				alert(
					`⚠️ Outlook Connection Error\n\n${decodedErrorMsg}\n\nIf you're using a university or work email, you may need to:\n1. Contact your IT administrator to approve the MIRA application\n2. Or try using a personal Microsoft account instead`
				);

				// If coming from onboarding, redirect back
				if (returnTo) {
					window.location.href = decodeURIComponent(returnTo);
					return;
				}
				return;
			}

			// Handle Microsoft/Outlook callback (only if not already handled above)
			if (msConnected === "true" && msEmail) {
				const purpose = urlParams.get("purpose");

				if (purpose === "calendar") {
					// Update calendar connections
					setConnectedCalendars((prev) => {
						if (!prev.includes("Outlook Calendar")) {
							return [...prev, "Outlook Calendar"];
						}
						return prev;
					});
				} else {
					// Update email connections
					setConnectedEmails((prev) => {
						if (!prev.includes("Outlook")) {
							return [...prev, "Outlook"];
						}
						return prev;
					});
				}

				// Reload settings from backend to get accurate connection status
				await loadUserSettings();

				// Clear URL parameters before redirect
				window.history.replaceState(
					{},
					document.title,
					window.location.pathname
				);

				// If coming from onboarding, redirect back
				if (returnTo) {
					window.location.href = decodeURIComponent(returnTo);
					return;
				}

				if (purpose === "calendar") {
					alert(
						`Outlook Calendar connected successfully! Email: ${msEmail}. Don't forget to click Save to persist this connection.`
					);
				} else {
					alert(
						`Outlook connected successfully! Email: ${msEmail}. Don't forget to click Save to persist this connection.`
					);
				}
				return;
			}
		};

		handleOAuthCallback();
	}, []); // Run once on mount to handle OAuth callbacks

	// Handle Gmail disconnection - update local state only, user must click Save
	const handleGmailDisconnect = async () => {
		try {
			// Remove Gmail access token from localStorage
			localStorage.removeItem("gmail_access_token");
			localStorage.removeItem("gmail_email");

			// Update connected emails state only - user must click Save to persist
			setConnectedEmails((prev) => prev.filter((email) => email !== "Gmail"));

			alert(
				"Gmail disconnected. Don't forget to click Save to persist this change."
			);
		} catch (error) {
			console.error("Failed to disconnect Gmail:", error);
			alert("Failed to disconnect Gmail");
		}
	};

	// Handle Outlook disconnection - update local state only, user must click Save
	const handleOutlookDisconnect = async () => {
		try {
			// Note: Microsoft token is in HttpOnly cookie, we can't remove it from frontend
			// The backend would need an endpoint to revoke it
			// For now, just update local state
			setConnectedEmails((prev) => prev.filter((email) => email !== "Outlook"));

			alert(
				"Outlook disconnected. Don't forget to click Save to persist this change."
			);
		} catch (error) {
			console.error("Failed to disconnect Outlook:", error);
			alert("Failed to disconnect Outlook");
		}
	};

	// Handle Google Calendar disconnection - update local state only, user must click Save
	const handleGoogleCalendarDisconnect = async () => {
		try {
			// Note: Google Calendar credentials are stored in backend database
			// We can't remove them from frontend directly
			// For now, just update local state - user must click Save to persist
			setConnectedCalendars((prev) =>
				prev.filter((cal) => cal !== "Google Calendar")
			);

			alert(
				"Google Calendar disconnected. Don't forget to click Save to persist this change."
			);
		} catch (error) {
			console.error("Failed to disconnect Google Calendar:", error);
			alert("Failed to disconnect Google Calendar");
		}
	};

	// Handle Outlook Calendar disconnection - update local state only, user must click Save
	const handleOutlookCalendarDisconnect = async () => {
		try {
			// Note: Microsoft token is in HttpOnly cookie, we can't remove it from frontend
			// The backend would need an endpoint to revoke it
			// For now, just update local state
			setConnectedCalendars((prev) =>
				prev.filter((cal) => cal !== "Outlook Calendar")
			);

			alert(
				"Outlook Calendar disconnected. Don't forget to click Save to persist this change."
			);
		} catch (error) {
			console.error("Failed to disconnect Outlook Calendar:", error);
			alert("Failed to disconnect Outlook Calendar");
		}
	};

	const tabs = [
		{ id: "profile" as TabType, label: "Profile" },
		{ id: "preferences" as TabType, label: "Preferences" },
		{ id: "notifications" as TabType, label: "Notifications" },
		{ id: "privacy" as TabType, label: "Privacy settings" },
		{ id: "subscription" as TabType, label: "Manage subscription" },
	];

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		try {
			const token = await getValidToken();
			if (!token) {
				alert("Your session has expired. Please log in again.");
				router.push("/login");
				return;
			}

			const apiBase = (
				process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
			).replace(/\/+$/, "");

			// Handle different save operations based on active tab
			if (activeTab === "profile") {
				const payload = {
					firstName: formData.firstName?.trim() || undefined,
					middleName: formData.middleName?.trim() || undefined,
					lastName: formData.lastName?.trim() || undefined,
					fullName:
						[formData.firstName?.trim(), formData.lastName?.trim()]
							.filter(Boolean)
							.join(" ") || undefined,
				};

				// Update auth.users user_metadata (for auth tokens)
				let res = await fetch(`${apiBase}/profile_update`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				// If we get a 401 or token expired error, try refreshing the token and retry once
				if (res.status === 401) {
					try {
						const errorData = await res.json().catch(() => ({}));
						if (
							errorData?.detail?.error_code === "token_expired" ||
							errorData?.detail?.message?.includes("expired")
						) {
							console.log("Token expired, attempting to refresh...");
							const newToken = await getValidToken();
							if (newToken) {
								// Retry the request with the new token
								res = await fetch(`${apiBase}/profile_update`, {
									method: "POST",
									headers: {
										Authorization: `Bearer ${newToken}`,
										"Content-Type": "application/json",
									},
									body: JSON.stringify(payload),
								});
							}
						}
					} catch (refreshError) {
						console.error("Error refreshing token:", refreshError);
					}
				}

				if (!res.ok) {
					let errorMessage = "Failed to save profile";
					try {
						const errorData = await res.json();
						errorMessage =
							errorData?.detail?.message ||
							errorData?.message ||
							errorData?.detail ||
							JSON.stringify(errorData) ||
							errorMessage;
					} catch {
						errorMessage = `Failed to save profile (${res.status}: ${res.statusText})`;
					}
					console.error("Profile update error:", errorMessage);

					// If it's still an auth error after refresh attempt, redirect to login
					if (res.status === 401) {
						alert("Your session has expired. Please log in again.");
						router.push("/login");
						return;
					}

					alert(errorMessage);
					return;
				}

				const data = await res.json().catch(() => ({}));

				// Also update user_profile table
				const email =
					userData?.email || localStorage.getItem("mira_email") || "";
				if (email) {
					const userProfilePayload = {
						email: email,
						firstName: formData.firstName?.trim() || "User",
						middleName: formData.middleName?.trim() || "",
						lastName: formData.lastName?.trim() || "",
					};

					// Save to user_profile table (don't wait for this)
					fetch(`${apiBase}/user_profile_save`, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(userProfilePayload),
					}).catch((err) =>
						console.error("Failed to update user_profile table:", err)
					);
				}

				try {
					// Update localStorage with new profile data
					const fullName = payload.fullName || "";
					if (fullName) {
						localStorage.setItem("mira_full_name", fullName);
					}

					// Extract user metadata from response
					const returned = data?.user || {};
					const meta = returned?.user_metadata || {};
					if (meta.full_name) {
						localStorage.setItem("mira_full_name", meta.full_name);
					}
					if (meta.avatar_url) {
						localStorage.setItem("mira_profile_picture", meta.avatar_url);
					}

					// Also update the onboarding data if available
					if (email && onboardingData) {
						// Update onboarding step2 with new name data
						const onboardingPayload = {
							email,
							step1: onboardingData?.step1 || {},
							step2: {
								firstName:
									formData.firstName?.trim() ||
									onboardingData?.step2?.firstName ||
									"",
								middleName:
									formData.middleName?.trim() ||
									onboardingData?.step2?.middleName ||
									"",
								lastName:
									formData.lastName?.trim() ||
									onboardingData?.step2?.lastName ||
									"",
							},
							step3: { connectedEmails },
							step4: { connectedCalendars },
							step5: onboardingData?.step5 || { permissions: {} },
						};

						// Save onboarding data in background (don't wait for it)
						fetch(`${apiBase}/onboarding_save`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify(onboardingPayload),
						}).catch((err) =>
							console.error("Failed to update onboarding data:", err)
						);
					}

					// Dispatch event to notify other components
					window.dispatchEvent(new CustomEvent("userDataUpdated"));

					// Reload user data
					loadUserData();
				} catch (err) {
					console.error("Error updating local storage:", err);
				}

				alert("Profile saved successfully!");
			} else if (activeTab === "preferences") {
				// Save preferences (language, timeZone, voice) to user_profile table
				const payload = {
					language: formData.language,
					timeZone: formData.timeZone,
					voice: formData.voice,
				};

				let res = await fetch(`${apiBase}/user_preferences_save`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				// Handle token expiration
				if (res.status === 401) {
					const newToken = await getValidToken();
					if (newToken) {
						res = await fetch(`${apiBase}/user_preferences_save`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${newToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						});
					}
				}

				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message =
						data?.detail?.message ||
						data?.message ||
						"Failed to save preferences";
					console.error("Preferences save error:", message);
					if (res.status === 401) {
						alert("Your session has expired. Please log in again.");
						router.push("/login");
						return;
					}
					alert(message);
					return;
				}

				// Update local state
				loadUserSettings();
				alert("Preferences saved successfully!");
			} else if (activeTab === "notifications") {
				// Save notification settings to user_profile table
				const payload = {
					pushNotifications: formData.pushNotifications,
					microphoneAccess: formData.microphoneAccess,
					wakeWordDetection: formData.wakeWordDetection,
				};

				let res = await fetch(`${apiBase}/user_notifications_save`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				// Handle token expiration
				if (res.status === 401) {
					const newToken = await getValidToken();
					if (newToken) {
						res = await fetch(`${apiBase}/user_notifications_save`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${newToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						});
					}
				}

				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message =
						data?.detail?.message ||
						data?.message ||
						"Failed to save notification settings";
					console.error("Notifications save error:", message);
					if (res.status === 401) {
						alert("Your session has expired. Please log in again.");
						router.push("/login");
						return;
					}
					alert(message);
					return;
				}

				// Update local state
				loadUserSettings();
				alert("Notification settings saved successfully!");
			} else if (activeTab === "privacy") {
				// Save privacy settings to user_profile table
				const payload = {
					connectedEmails: connectedEmails,
					connectedCalendars: connectedCalendars,
				};

				// If Gmail is connected, also save Gmail credentials to backend for persistence
				if (connectedEmails.includes("Gmail")) {
					const gmailAccessToken = localStorage.getItem("gmail_access_token");
					const gmailRefreshToken = localStorage.getItem("gmail_refresh_token");
					if (gmailAccessToken) {
						try {
							// Save Gmail credentials to backend so connection persists
							await fetch(`${apiBase}/gmail/credentials/save`, {
								method: "POST",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									gmail_access_token: gmailAccessToken,
									gmail_refresh_token: gmailRefreshToken || null,
								}),
							});
						} catch (error) {
							console.error("Error saving Gmail credentials:", error);
							// Continue anyway - don't block the privacy save
						}
					}
				}

				let res = await fetch(`${apiBase}/user_privacy_save`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				// Handle token expiration
				if (res.status === 401) {
					const newToken = await getValidToken();
					if (newToken) {
						res = await fetch(`${apiBase}/user_privacy_save`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${newToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						});
					}
				}

				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message =
						data?.detail?.message ||
						data?.message ||
						"Failed to save privacy settings";
					console.error("Privacy save error:", message);
					if (res.status === 401) {
						alert("Your session has expired. Please log in again.");
						router.push("/login");
						return;
					}
					alert(message);
					return;
				}

				// Update local state
				loadUserSettings();
				alert("Privacy settings saved successfully!");
			} else if (activeTab === "subscription") {
				// Save subscription settings to user_profile table
				const payload = {
					selectedPlan: formData.selectedPlan,
					cardName: formData.cardName?.trim() || "",
					cardNumber: formData.cardNumber?.trim() || "",
					expDate: formData.expDate?.trim() || "",
					cvv: formData.cvv?.trim() || "",
					address: formData.address?.trim() || "",
					city: formData.city?.trim() || "",
					state: formData.state?.trim() || "",
					postalCode: formData.postalCode?.trim() || "",
				};

				let res = await fetch(`${apiBase}/user_subscription_save`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				// Handle token expiration
				if (res.status === 401) {
					const newToken = await getValidToken();
					if (newToken) {
						res = await fetch(`${apiBase}/user_subscription_save`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${newToken}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(payload),
						});
					}
				}

				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message =
						data?.detail?.message ||
						data?.message ||
						"Failed to save subscription";
					console.error("Subscription save error:", message);
					if (res.status === 401) {
						alert("Your session has expired. Please log in again.");
						router.push("/login");
						return;
					}
					alert(message);
					return;
				}

				// Update local state
				loadUserSettings();
				alert("Subscription details saved successfully!");
			} else {
				alert("Settings saved");
			}
		} catch (e) {
			console.error("Failed to save:", e);
			alert("Something went wrong while saving.");
		}
	};

	const renderProfileTab = () => (
		<div className="space-y-4 sm:space-y-5">
			<p className="text-base sm:text-lg md:text-xl text-gray-800 leading-6">
				Update your personal information, profile photo, and account details to
				keep your profile up to date.
			</p>

			<div className="space-y-6 sm:space-y-8">
				{/* Profile Picture */}
				<div className="space-y-2 sm:space-y-3">
					<h3 className="text-base sm:text-lg text-gray-700 font-normal">Profile Picture</h3>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
						<div className="w-24 h-24 sm:w-28 sm:h-28 md:w-30 md:h-30 bg-pink-400 rounded-full flex items-center justify-center overflow-hidden shrink-0">
							{userData?.picture ? (
								<Image
									src={userData.picture}
									alt="Profile Picture"
									width={120}
									height={120}
									className="w-full h-full object-cover"
								/>
							) : (
								<span className="text-4xl sm:text-5xl md:text-6xl text-black font-bold">
									{userData?.fullName?.charAt(0) ||
										userData?.email?.charAt(0) ||
										"J"}
								</span>
							)}
						</div>
						<button className="px-3 sm:px-4 py-2 bg-gray-50 border border-gray-800 rounded-full text-xs sm:text-sm text-gray-800 hover:bg-gray-100 transition-colors font-light">
							Change Picture
						</button>
					</div>
				</div>

				{/* Form Fields */}
				<div className="space-y-4 sm:space-y-5">
					<div>
						<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">Email</label>
						<input
							type="email"
							value={formData.email}
							onChange={(e) => handleInputChange("email", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
							placeholder="Enter your email"
						/>
					</div>

					<div>
						<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
							First name<span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={formData.firstName}
							onChange={(e) => handleInputChange("firstName", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
							placeholder="Enter your first name"
						/>
					</div>

					<div>
						<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
							Middle name
						</label>
						<input
							type="text"
							value={formData.middleName}
							onChange={(e) => handleInputChange("middleName", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
							placeholder="Enter your middle name"
						/>
					</div>

					<div>
						<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
							Last name<span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={formData.lastName}
							onChange={(e) => handleInputChange("lastName", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
							placeholder="Enter your last name"
						/>
					</div>
				</div>

				<button
					onClick={handleSave}
					className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800 text-white rounded-full font-semibold text-sm sm:text-base md:text-lg hover:bg-gray-900 transition-colors"
				>
					Save
				</button>
			</div>
		</div>
	);

	const renderPreferencesTab = () => (
		<div className="space-y-4 sm:space-y-5">
			<p className="text-base sm:text-lg md:text-xl text-gray-800 leading-6">
				Customize your experience by adjusting language, region, and voice
				options to suit your needs.
			</p>

			<div className="space-y-4 sm:space-y-5 w-full sm:w-80">
				<div>
					<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">Language</label>
					<div className="relative">
						<select
							value={formData.language}
							onChange={(e) => handleInputChange("language", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 appearance-none text-sm sm:text-base text-gray-900"
						>
							<option value="English">Select Language</option>
							<option value="Spanish">Spanish</option>
							<option value="French">French</option>
							<option value="German">German</option>
						</select>
						<ChevronDown className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
					</div>
				</div>

				<div>
					<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">Time Zone</label>
					<div className="relative">
						<select
							value={formData.timeZone}
							onChange={(e) => handleInputChange("timeZone", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 appearance-none text-sm sm:text-base text-gray-900"
						>
							<option value="UTC-5 (Eastern Time)">Select Time Zone</option>
							<option value="UTC-6 (Central Time)">UTC-6 (Central Time)</option>
							<option value="UTC-7 (Mountain Time)">
								UTC-7 (Mountain Time)
							</option>
							<option value="UTC-8 (Pacific Time)">UTC-8 (Pacific Time)</option>
						</select>
						<ChevronDown className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
					</div>
				</div>

				<div>
					<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">Voice</label>
					<div className="relative">
						<select
							value={formData.voice}
							onChange={(e) => handleInputChange("voice", e.target.value)}
							className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 appearance-none text-sm sm:text-base text-gray-900"
						>
							<option value="Default">Select Voice</option>
							<option value="Male">Male</option>
							<option value="Female">Female</option>
							<option value="Neutral">Neutral</option>
						</select>
						<ChevronDown className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
					</div>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800 text-white rounded-full font-semibold text-sm sm:text-base md:text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderNotificationsTab = () => (
		<div className="space-y-4 sm:space-y-5">
			<p className="text-base sm:text-lg md:text-xl text-gray-800 leading-6">
				Choose how and when you&apos;d like to receive updates, alerts, and
				promotional messages.
			</p>

			<div className="space-y-4 sm:space-y-5">
				{/* Push Notifications */}
				<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						<div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center p-1.5 sm:p-2 shrink-0">
							<Image
								src="/Icons/image 9.png"
								alt="Push Notification"
								width={24}
								height={24}
								className="w-full h-full object-contain"
							/>
						</div>
						<div className="ml-1 sm:ml-2 min-w-0">
							<h4 className="text-sm sm:text-base md:text-lg text-gray-700 font-normal">
								Push Notification
							</h4>
							<p className="text-xs sm:text-sm text-gray-500">
								Get notified about important emails and reminders
							</p>
						</div>
					</div>
					<CustomCheckbox
						checked={formData.pushNotifications}
						onChange={(checked) =>
							handleInputChange("pushNotifications", checked)
						}
					/>
				</div>

				{/* Microphone Access */}
				<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						<div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center p-1.5 sm:p-2 shrink-0">
							<Image
								src="/Icons/image 10.png"
								alt="Microphone Access"
								width={24}
								height={24}
								className="w-full h-full object-contain"
							/>
						</div>
						<div className="ml-1 sm:ml-2 min-w-0">
							<h4 className="text-sm sm:text-base md:text-lg text-gray-700 font-normal">
								Microphone Access
							</h4>
							<p className="text-xs sm:text-sm text-gray-500">
								Use voice commands to interact with Mira
							</p>
						</div>
					</div>
					<CustomCheckbox
						checked={formData.microphoneAccess}
						onChange={(checked) =>
							handleInputChange("microphoneAccess", checked)
						}
					/>
				</div>

				{/* Wake Word Detection */}
				<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						<div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center p-1.5 sm:p-2 shrink-0">
							<Image
								src="/Icons/image 11.png"
								alt="Wake Word Detection"
								width={24}
								height={24}
								className="w-full h-full object-contain"
							/>
						</div>
						<div className="ml-1 sm:ml-2 min-w-0">
							<h4 className="text-sm sm:text-base md:text-lg text-gray-700 font-normal">
								Wake Word Detection
							</h4>
							<p className="text-xs sm:text-sm text-gray-500">
								Activate Mira with your voice
							</p>
						</div>
					</div>
					<CustomCheckbox
						checked={formData.wakeWordDetection}
						onChange={(checked) =>
							handleInputChange("wakeWordDetection", checked)
						}
					/>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800 text-white rounded-full font-semibold text-sm sm:text-base md:text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderPrivacyTab = () => (
		<div className="space-y-4 sm:space-y-5">
			<p className="text-base sm:text-lg md:text-xl text-gray-800 leading-6">
				Control what information you share and manage how your data is used to
				keep your account secure.
			</p>

			<div className="space-y-6 sm:space-y-8">
				{/* Email Connections */}
				<div>
					<h3 className="text-lg sm:text-xl text-gray-800 mb-3 sm:mb-5">Your Email</h3>
					<div className="space-y-4 sm:space-y-5">
						<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
							<div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
								<div className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center shrink-0">
									<Image
										src="/Icons/image 4.png"
										alt="Gmail"
										width={24}
										height={24}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="text-sm sm:text-base md:text-lg text-gray-700">Gmail</span>
								{connectedEmails.includes("Gmail") && (
									<span className="text-[10px] sm:text-xs bg-green-100 text-green-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap shrink-0">
										Connected
									</span>
								)}
							</div>
							<button
								onClick={() => {
									if (connectedEmails.includes("Gmail")) {
										handleGmailDisconnect();
									} else {
										// Handle connect - no return_to for settings page
										const apiBase = (
											process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
										).replace(/\/+$/, "");
										window.location.href = `${apiBase}/gmail/auth`;
									}
								}}
								className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
									connectedEmails.includes("Gmail")
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100"
								}`}
							>
								{connectedEmails.includes("Gmail") ? "Disconnect" : "Connect"}
							</button>
						</div>

						<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
							<div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
								<div className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center shrink-0">
									<Image
										src="/Icons/image 5.png"
										alt="Outlook"
										width={24}
										height={24}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="text-sm sm:text-base md:text-lg text-gray-700">Outlook</span>
								{connectedEmails.includes("Outlook") && (
									<span className="text-[10px] sm:text-xs bg-green-100 text-green-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap shrink-0">
										Connected
									</span>
								)}
							</div>
							<button
								onClick={() => {
									if (connectedEmails.includes("Outlook")) {
										handleOutlookDisconnect();
									} else {
										const apiBase = (
											process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
										).replace(/\/+$/, "");
										const token =
											localStorage.getItem("access_token") ||
											localStorage.getItem("token");
										if (!token) {
											alert("Please log in first to connect Outlook.");
											return;
										}
										// Pass token so backend can identify user and save credentials properly
										window.location.href = `${apiBase}/microsoft/auth?token=${encodeURIComponent(
											token
										)}`;
									}
								}}
								className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
									connectedEmails.includes("Outlook")
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100"
								}`}
							>
								{connectedEmails.includes("Outlook") ? "Disconnect" : "Connect"}
							</button>
						</div>

						{/* Microsoft 365 - commented out as it's the same as Outlook */}
						{/* <div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 6.png" alt="Microsoft 365" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Microsoft 365</span>
								{connectedEmails.includes("Microsoft 365") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => {
									const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
									window.location.href = `${apiBase}/microsoft/auth`;
								}}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div> */}
					</div>
				</div>

				{/* Calendar Connections */}
				<div>
					<h3 className="text-lg sm:text-xl text-gray-800 mb-3 sm:mb-5">Your Calendar</h3>
					<div className="space-y-4 sm:space-y-5">
						<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
							<div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
								<div className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center shrink-0">
									<Image
										src="/Icons/image 7.png"
										alt="Google Calendar"
										width={24}
										height={24}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="text-sm sm:text-base md:text-lg text-gray-700">Google Calendar</span>
								{connectedCalendars.includes("Google Calendar") && (
									<span className="text-[10px] sm:text-xs bg-green-100 text-green-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap shrink-0">
										Connected
									</span>
								)}
							</div>
							<button
								onClick={async () => {
									if (connectedCalendars.includes("Google Calendar")) {
										handleGoogleCalendarDisconnect();
									} else {
										try {
											const apiBase = (
												process.env.NEXT_PUBLIC_API_URL ||
												"http://127.0.0.1:8000"
											).replace(/\/+$/, "");
											const token =
												localStorage.getItem("access_token") ||
												localStorage.getItem("token");
											if (!token) {
												alert(
													"Please log in first to connect Google Calendar."
												);
												return;
											}
											// Pass token as query parameter so backend can extract user ID
											window.location.href = `${apiBase}/google/calendar/oauth/start?token=${encodeURIComponent(
												token
											)}`;
										} catch (error) {
											console.error("Error connecting Google Calendar:", error);
											alert(
												"Failed to connect Google Calendar. Please try again."
											);
										}
									}
								}}
								className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
									connectedCalendars.includes("Google Calendar")
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100"
								}`}
							>
								{connectedCalendars.includes("Google Calendar")
									? "Disconnect"
									: "Connect"}
							</button>
						</div>

						<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
							<div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
								<div className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center shrink-0">
									<Image
										src="/Icons/image 5.png"
										alt="Outlook Calendar"
										width={24}
										height={24}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="text-sm sm:text-base md:text-lg text-gray-700">Outlook Calendar</span>
								{connectedCalendars.includes("Outlook Calendar") && (
									<span className="text-[10px] sm:text-xs bg-green-100 text-green-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap shrink-0">
										Connected
									</span>
								)}
							</div>
							<button
								onClick={() => {
									if (connectedCalendars.includes("Outlook Calendar")) {
										handleOutlookCalendarDisconnect();
									} else {
										const apiBase = (
											process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
										).replace(/\/+$/, "");
										const token =
											localStorage.getItem("access_token") ||
											localStorage.getItem("token");
										if (!token) {
											alert("Please log in first to connect Outlook Calendar.");
											return;
										}
										// Pass token so backend can identify user and save credentials properly
										window.location.href = `${apiBase}/microsoft/auth?token=${encodeURIComponent(
											token
										)}&purpose=calendar`;
									}
								}}
								className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
									connectedCalendars.includes("Outlook Calendar")
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100"
								}`}
							>
								{connectedCalendars.includes("Outlook Calendar")
									? "Disconnect"
									: "Connect"}
							</button>
						</div>

						{/* Microsoft Calendar - commented out as it's the same as Outlook Calendar */}
						{/* <div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 6.png" alt="Microsoft Calendar" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Microsoft Calendar</span>
								{connectedCalendars.includes("Microsoft Calendar") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => alert("Microsoft Calendar integration coming soon!")}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div> */}

						<div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white rounded-lg border border-gray-400 gap-3">
							<div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
								<div className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center shrink-0">
									<Image
										src="/Icons/image 8.png"
										alt="Exchange Calendar"
										width={24}
										height={24}
										className="w-full h-full object-contain"
									/>
								</div>
								<span className="text-sm sm:text-base md:text-lg text-gray-700">Exchange Calendar</span>
								{connectedCalendars.includes("Exchange Calendar") && (
									<span className="text-[10px] sm:text-xs bg-green-100 text-green-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap shrink-0">
										Connected
									</span>
								)}
							</div>
							<button
								onClick={() =>
									alert("Exchange Calendar integration coming soon!")
								}
								className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap shrink-0"
							>
								Connect
							</button>
						</div>
					</div>
				</div>

				{/* Permissions */}
				<div className="space-y-4 sm:space-y-5">
					<div className="flex items-start gap-2 sm:gap-3">
						<CustomCircularCheckbox
							checked={formData.emailAccess}
							onChange={(checked) => handleInputChange("emailAccess", checked)}
							className="mt-1 shrink-0"
						/>
						<p className="text-sm sm:text-base text-gray-700 leading-5">
							Allow Mira to access your email to read, compose, manage drafts,
							and send emails from your connected accounts.{" "}
							<a href="#" className="text-gray-500 underline text-xs sm:text-sm">
								Learn more
							</a>
						</p>
					</div>

					<div className="flex items-start gap-2 sm:gap-3">
						<CustomCircularCheckbox
							checked={formData.calendarAccess}
							onChange={(checked) =>
								handleInputChange("calendarAccess", checked)
							}
							className="mt-1 shrink-0"
						/>
						<p className="text-sm sm:text-base text-gray-700 leading-5">
							Allow Mira to access your calendar to view, create, edit, and
							manage your events and reminders across connected accounts.
						</p>
					</div>

					{/* Privacy Policy Section */}
					<div className="mt-4 sm:mt-6">
						<p className="text-sm sm:text-base md:text-lg text-gray-800 leading-6">
							<span className="font-bold">Make sure you trust Mira:</span>{" "}
							Review{" "}
							<a href="#" className="text-purple-600 underline">
								Mira&apos;s Privacy Policy
							</a>{" "}
							and{" "}
							<a href="#" className="text-purple-600 underline">
								Terms of Service
							</a>{" "}
							to understand how Mira will process and protect your data.
						</p>
					</div>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800 text-white rounded-full font-semibold text-sm sm:text-base md:text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderSubscriptionTab = () => (
		<div className="space-y-4 sm:space-y-5">
			<p className="text-base sm:text-lg md:text-xl text-gray-800 leading-6">
				View your current plan, update billing details, or upgrade your
				subscription anytime.
			</p>

			<div className="space-y-4 sm:space-y-5">
				{/* Plan Selection */}
				<div className="space-y-4 sm:space-y-5">
					<div
						className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 rounded-lg border gap-3 ${
							formData.selectedPlan === "basic"
								? "border-gray-400 bg-gray-50"
								: "border-gray-400 bg-white"
						}`}
					>
						<div className="flex items-center gap-2 min-w-0 flex-1">
							<div className="w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center shrink-0">
								<Image
									src="/Icons/Ellipse 12.svg"
									alt="Basic Plan"
									width={40}
									height={40}
									className="w-full h-full object-contain"
								/>
							</div>
							<div className="min-w-0">
								<h4 className="text-sm sm:text-base md:text-lg font-normal text-gray-700">
									Basic Plan - Free
								</h4>
								<p className="text-xs sm:text-sm text-gray-500">
									AI assistant managing Email, calendar, and meeting
								</p>
							</div>
						</div>
						<div className="relative shrink-0">
							<CustomRadioButton
								name="plan"
								value="basic"
								checked={formData.selectedPlan === "basic"}
								onChange={(value) => handleInputChange("selectedPlan", value)}
							/>
						</div>
					</div>

					<div
						className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 rounded-lg border gap-3 ${
							formData.selectedPlan === "advanced"
								? "border-gray-400 bg-gray-50"
								: "border-gray-400 bg-white"
						}`}
					>
						<div className="flex items-center gap-2 min-w-0 flex-1">
							<div className="w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center shrink-0">
								<Image
									src="/Icons/Ellipse 10.svg"
									alt="Advanced Plan"
									width={40}
									height={40}
									className="w-full h-full object-contain"
								/>
							</div>
							<div className="min-w-0">
								<h4 className="text-sm sm:text-base md:text-lg font-normal text-gray-700">
									Advanced Plan - $9/month
								</h4>
								<p className="text-xs sm:text-sm text-gray-500">
									AI assistant with customized voice
								</p>
							</div>
						</div>
						<div className="relative shrink-0">
							<CustomRadioButton
								name="plan"
								value="advanced"
								checked={formData.selectedPlan === "advanced"}
								onChange={(value) => handleInputChange("selectedPlan", value)}
							/>
						</div>
					</div>

					<div
						className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 rounded-lg border gap-3 ${
							formData.selectedPlan === "premium"
								? "border-gray-400 bg-gray-50"
								: "border-gray-400 bg-white"
						}`}
					>
						<div className="flex items-center gap-2 min-w-0 flex-1">
							<div className="w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center shrink-0">
								<Image
									src="/Icons/Ellipse 11.svg"
									alt="Premium Plan"
									width={40}
									height={40}
									className="w-full h-full object-contain"
								/>
							</div>
							<div className="min-w-0">
								<h4 className="text-sm sm:text-base md:text-lg font-normal text-gray-700">
									Premium Plan - $19/month
								</h4>
								<p className="text-xs sm:text-sm text-gray-500">
									Customized voice AI assistant being able to make appointments
									for you
								</p>
							</div>
						</div>
						<div className="relative shrink-0">
							<CustomRadioButton
								name="plan"
								value="premium"
								checked={formData.selectedPlan === "premium"}
								onChange={(value) => handleInputChange("selectedPlan", value)}
							/>
						</div>
					</div>
				</div>

				{/* Card Details */}
				<div className="space-y-6 sm:space-y-8 md:space-y-10">
					<div>
						<h3 className="text-xl sm:text-2xl font-medium text-gray-800 mb-1 sm:mb-2">
							Card Details
						</h3>
						<p className="text-sm sm:text-base md:text-lg text-gray-500">Update your card details.</p>
					</div>

					<div className="space-y-4 sm:space-y-5">
						<div>
							<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
								Name on card
							</label>
							<input
								type="text"
								value={formData.cardName}
								onChange={(e) => handleInputChange("cardName", e.target.value)}
								className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
								placeholder="Enter name on card"
							/>
						</div>

						<div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
							<div className="flex-1">
								<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
									Card number
								</label>
								<input
									type="text"
									value={formData.cardNumber}
									onChange={(e) =>
										handleInputChange("cardNumber", e.target.value)
									}
									className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
									placeholder="1234 5678 9012 3456"
								/>
							</div>
							<div className="w-full sm:w-28">
								<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
									Exp date
								</label>
								<input
									type="text"
									value={formData.expDate}
									onChange={(e) => handleInputChange("expDate", e.target.value)}
									className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
									placeholder="MM/YY"
								/>
							</div>
							<div className="w-full sm:w-28">
								<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">CVV</label>
								<input
									type="text"
									value={formData.cvv}
									onChange={(e) => handleInputChange("cvv", e.target.value)}
									className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
									placeholder="123"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
								Address
							</label>
							<input
								type="text"
								value={formData.address}
								onChange={(e) => handleInputChange("address", e.target.value)}
								className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
								placeholder="Enter your address"
							/>
						</div>

						<div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
							<div className="flex-1">
								<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">City</label>
								<input
									type="text"
									value={formData.city}
									onChange={(e) => handleInputChange("city", e.target.value)}
									className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
									placeholder="Enter city"
								/>
							</div>
							<div className="w-full sm:w-28">
								<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
									State
								</label>
								<input
									type="text"
									value={formData.state}
									onChange={(e) => handleInputChange("state", e.target.value)}
									className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
									placeholder="State"
								/>
							</div>
							<div className="w-full sm:w-28">
								<label className="block text-sm sm:text-base md:text-lg text-gray-700 mb-2 sm:mb-3">
									Postal code
								</label>
								<input
									type="text"
									value={formData.postalCode}
									onChange={(e) =>
										handleInputChange("postalCode", e.target.value)
									}
									className="w-full h-12 sm:h-14 px-3 sm:px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base text-gray-900 placeholder-gray-500"
									placeholder="12345"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800 text-white rounded-full font-semibold text-sm sm:text-base md:text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderTabContent = () => {
		switch (activeTab) {
			case "profile":
				return renderProfileTab();
			case "preferences":
				return renderPreferencesTab();
			case "notifications":
				return renderNotificationsTab();
			case "privacy":
				return renderPrivacyTab();
			case "subscription":
				return renderSubscriptionTab();
			default:
				return renderProfileTab();
		}
	};

	// Format a friendly date string for the provided timezone.
	const getFormattedDate = (tz: string) => {
		try {
			const now = new Date();
			return new Intl.DateTimeFormat("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
				timeZone: tz,
			}).format(now);
		} catch {
			return new Date().toLocaleDateString(undefined, {
				weekday: "short",
				month: "short",
				day: "numeric",
			});
		}
	};

	// Fetch current weather using Open-Meteo API directly
	const fetchWeatherForCoords = async (lat: number, lon: number) => {
		try {
			setIsWeatherLoading(true);
			console.log("Settings: fetching weather for coords:", lat, lon);
			const data = await getWeather(lat, lon);
			const temp = data?.temperatureC;
			if (typeof temp === "number") setTemperatureC(temp);
			else
				console.warn(
					"Settings: weather response did not contain a numeric temperature",
					data
				);
		} catch (err) {
			console.error("Settings: Error fetching weather:", err);
		} finally {
			setIsWeatherLoading(false);
		}
	};

	useEffect(() => {
		if (latitude != null && longitude != null) {
			fetchWeatherForCoords(latitude, longitude).catch((e) => console.error(e));
		}
	}, [latitude, longitude]);

	return (
		<div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6 lg:p-8">
			{/* Header */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-3 sm:gap-4">
				<div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 lg:gap-8">
					<div className="flex items-center gap-1.5 sm:gap-2">
						<span className="text-xs sm:text-sm md:text-base text-gray-800">
							{getFormattedDate(timezone)}
						</span>
					</div>
					<div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 bg-white rounded-full border border-gray-200">
						<MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-gray-600 shrink-0" />
						<span className="text-xs sm:text-sm md:text-base text-gray-800 truncate max-w-[100px] sm:max-w-none">
							{isLocationLoading ? "Detecting..." : location}
						</span>
					</div>
					<div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 bg-white rounded-full border border-gray-200">
						<Sun className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-500 shrink-0" />
						<span className="text-xs sm:text-sm md:text-base text-gray-800">
							{isWeatherLoading
								? "..."
								: temperatureC != null
								? `${Math.round(temperatureC)}°`
								: "—"}
						</span>
					</div>
				</div>
				<div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-white rounded-lg border border-gray-200 flex items-center justify-center shrink-0">
					<Bell className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-600" />
				</div>
			</div>

			{/* Title */}
			<div className="mb-4 sm:mb-6 md:mb-8">
				<h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-black">Settings</h1>
			</div>

			{/* Tab Navigation */}
			<div className="flex items-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 mb-4 sm:mb-6 md:mb-8 border-b border-gray-300 overflow-x-auto scrollbar-hide">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className={`px-2 py-1 text-sm sm:text-base md:text-lg lg:text-xl transition-colors whitespace-nowrap shrink-0 ${
							activeTab === tab.id
								? "text-gray-800 font-medium border-b-2 border-purple-600 pb-3 sm:pb-4"
								: "text-gray-500 font-medium hover:text-gray-700 pb-3 sm:pb-4"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>
			<Sidebar />
			{/* Tab Content */}
			<div className="max-w-4xl">{renderTabContent()}</div>
		</div>
	);
}
