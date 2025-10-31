/** @format */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isAuthenticated, getStoredUserData, UserData, getStoredToken } from "@/utils/auth";
import { ChevronDown, Sun, MapPin, Bell, Check } from "lucide-react";

// Custom Checkbox Component (Square for Notifications)
const CustomCheckbox = ({ checked, onChange, className = "" }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) => (
	<div className={`relative w-5 h-5 ${className}`}>
		<div className={`absolute inset-0 border-2 border-gray-400 rounded ${checked ? 'bg-gray-400 border-gray-400' : 'bg-transparent'}`} />
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
const CustomCircularCheckbox = ({ checked, onChange, className = "" }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) => (
	<div className={`relative w-5 h-5 ${className}`}>
		<div className={`absolute inset-0 border-2 border-gray-400 rounded-full ${checked ? 'bg-gray-400 border-gray-400' : 'bg-transparent'}`} />
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
const CustomRadioButton = ({ checked, onChange, name, value, className = "" }: { checked: boolean; onChange: (value: string) => void; name: string; value: string; className?: string }) => (
	<div className={`relative w-5 h-5 ${className}`}>
		<div className={`absolute inset-0 border-2 border-gray-400 rounded-full ${checked ? 'bg-gray-400 border-gray-400' : 'bg-transparent'}`} />
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

type TabType = 'profile' | 'preferences' | 'notifications' | 'privacy' | 'subscription';

export default function SettingsPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabType>('profile');
	const [userData, setUserData] = useState<UserData | null>(null);
	const [formData, setFormData] = useState({
		email: '',
		firstName: '',
		middleName: '',
		lastName: '',
		language: 'English',
		timeZone: 'UTC-5 (Eastern Time)',
		voice: 'Default',
		pushNotifications: true,
		microphoneAccess: false,
		wakeWordDetection: false,
		emailAccess: true,
		calendarAccess: true,
		selectedPlan: 'basic',
		cardName: '',
		cardNumber: '',
		expDate: '',
		cvv: '',
		address: '',
		city: '',
		state: '',
		postalCode: ''
	});
	const [onboardingData, setOnboardingData] = useState<any>(null);
	const [connectedEmails, setConnectedEmails] = useState<string[]>([]);
	const [connectedCalendars, setConnectedCalendars] = useState<string[]>([]);

	// Location state (defaults to New York)
	const [location, setLocation] = useState<string>("New York");
	const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);

	// Check authentication on mount and load user data
	useEffect(() => {
		if (!isAuthenticated()) {
			router.push('/login');
			return;
		}
		loadUserData();
		loadOnboardingData();
	}, [router]);

	// Load user data from localStorage
	const loadUserData = () => {
		const storedUserData = getStoredUserData();
		setUserData(storedUserData);
		if (storedUserData) {
			const nameParts = storedUserData.fullName?.split(' ') || [];
			setFormData(prev => ({
				...prev,
				email: storedUserData.email || '',
				firstName: nameParts[0] || '',
				lastName: nameParts.slice(1).join(' ') || ''
			}));
		}
	};

	// Load onboarding data from backend
	const loadOnboardingData = async () => {
		try {
			const token = getStoredToken();
			if (!token) return;

			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			const email = userData?.email || localStorage.getItem("mira_email") || "";
			
			if (!email) return;

			const response = await fetch(`${apiBase}/onboarding_data?email=${encodeURIComponent(email)}`, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				if (data.onboarded && data.data) {
					setOnboardingData(data.data);
					
					// Update connected services
					if (data.data.connectedEmails) {
						setConnectedEmails(data.data.connectedEmails);
					}
					if (data.data.connectedCalendars) {
						setConnectedCalendars(data.data.connectedCalendars);
					}
					
					// Update permissions
					setFormData(prev => ({
						...prev,
						pushNotifications: data.data.pushNotifications ?? true,
						microphoneAccess: data.data.microphoneAccess ?? false,
						wakeWordDetection: data.data.wakeWordDetection ?? false
					}));
				}
			}
		} catch (error) {
			console.error('Failed to load onboarding data:', error);
		}
	};

	// Listen for user data updates (from Google OAuth or manual signup/login)
	useEffect(() => {
		const handleUserDataUpdate = () => {
			console.log('User data updated, reloading...');
			loadUserData();
			loadOnboardingData();
		};

		window.addEventListener('userDataUpdated', handleUserDataUpdate);
		return () => window.removeEventListener('userDataUpdated', handleUserDataUpdate);
	}, []);

	// Added: get system/geolocation and reverse-geocode to a readable place name
	useEffect(() => {
		// Helper: IP-based fallback when geolocation is unavailable or denied
		const ipFallback = async () => {
			try {
				const res = await fetch("https://ipapi.co/json/");
				if (!res.ok) return;
				const data = await res.json();
				const city = data.city || data.region || data.region_code || data.country_name;
				if (city) setLocation(city);
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
				// Use OpenStreetMap Nominatim reverse geocoding (no key required)
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
				);
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
			} catch (err) {
				console.error("reverse geocode error:", err);
				await ipFallback();
			} finally {
				setIsLocationLoading(false);
			}
		};

		const error = async (err: GeolocationPositionError | any) => {
			console.error("geolocation error:", err);
			// On permission denied or other errors, try IP-based lookup
			await ipFallback();
		};

		navigator.geolocation.getCurrentPosition(success, error, { timeout: 10000 });
	}, []);

	// Handle Gmail disconnection
	const handleGmailDisconnect = async () => {
		try {
			// Remove Gmail access token from localStorage
			localStorage.removeItem("gmail_access_token");
			localStorage.removeItem("gmail_email");
			
			// Update connected emails state
			setConnectedEmails(prev => prev.filter(email => email !== "Gmail"));
			
			// Save the updated state
			await handleSave();
			
			alert("Gmail disconnected successfully");
		} catch (error) {
			console.error('Failed to disconnect Gmail:', error);
			alert('Failed to disconnect Gmail');
		}
	};

	const tabs = [
		{ id: 'profile' as TabType, label: 'Profile' },
		{ id: 'preferences' as TabType, label: 'Preferences' },
		{ id: 'notifications' as TabType, label: 'Notifications' },
		{ id: 'privacy' as TabType, label: 'Privacy settings' },
		{ id: 'subscription' as TabType, label: 'Manage subscription' }
	];

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData(prev => ({ ...prev, [field]: value }));
	};

	const handleSave = async () => {
		try {
			const token = getStoredToken();
			if (!token) {
				alert('Please log in again.');
				router.push('/login');
				return;
			}

			const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
			
			// Handle different save operations based on active tab
			if (activeTab === 'profile') {
				const payload = {
					firstName: formData.firstName?.trim() || undefined,
					middleName: formData.middleName?.trim() || undefined,
					lastName: formData.lastName?.trim() || undefined,
					fullName: [formData.firstName?.trim(), formData.lastName?.trim()].filter(Boolean).join(' ') || undefined,
					// picture can be wired when Change Picture is implemented
				};

				const res = await fetch(`${apiBase}/profile_update`, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message = data?.detail?.message || data?.message || 'Failed to save profile';
					alert(message);
					return;
				}

				// Update localStorage for immediate UI reflect
				try {
					const fullName = payload.fullName || '';
					if (fullName) localStorage.setItem('mira_full_name', fullName);
					// If backend returns avatar/full name, prefer that
					const returned = data?.user || {};
					const meta = returned?.user_metadata || returned?.user?.user_metadata || {};
					if (meta.full_name) localStorage.setItem('mira_full_name', meta.full_name);
					if (meta.avatar_url) localStorage.setItem('mira_profile_picture', meta.avatar_url);
					window.dispatchEvent(new CustomEvent('userDataUpdated'));
				} catch {}

				alert('Profile saved');
			} else if (activeTab === 'privacy' || activeTab === 'notifications') {
				// Save privacy/notification settings
				const email = userData?.email || localStorage.getItem("mira_email") || "";
				if (!email) {
					alert('Email not found. Please log in again.');
					return;
				}

				const payload = {
					email,
					step1: onboardingData?.step1 || {},
					step2: onboardingData?.step2 || {},
					step3: { connectedEmails },
					step4: { connectedCalendars },
					step5: { 
						permissions: {
							pushNotifications: formData.pushNotifications,
							microphoneAccess: formData.microphoneAccess,
							wakeWordDetection: formData.wakeWordDetection
						}
					},
				};

				const res = await fetch(`${apiBase}/onboarding_save`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(payload)
				});

				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					const message = data?.detail?.message || data?.message || 'Failed to save settings';
					alert(message);
					return;
				}

				alert('Settings saved');
			} else {
				alert('Settings saved');
			}
		} catch (e) {
			console.error('Failed to save:', e);
			alert('Something went wrong while saving.');
		}
	};

	const renderProfileTab = () => (
		<div className="space-y-5">
			<p className="text-xl text-gray-800 leading-6">
				Update your personal information, profile photo, and account details to keep your profile up to date.
			</p>
			
			<div className="space-y-8">
				{/* Profile Picture */}
				<div className="space-y-3">
					<h3 className="text-lg text-gray-700 font-normal">Profile Picture</h3>
					<div className="flex items-center gap-5">
						<div className="w-30 h-30 bg-pink-400 rounded-full flex items-center justify-center overflow-hidden">
							{userData?.picture ? (
								<Image
									src={userData.picture}
									alt="Profile Picture"
									width={120}
									height={120}
									className="w-full h-full object-cover"
								/>
							) : (
								<span className="text-6xl text-black font-bold">
									{userData?.fullName?.charAt(0) || userData?.email?.charAt(0) || 'J'}
								</span>
							)}
						</div>
						<button className="px-4 py-2 bg-gray-50 border border-gray-800 rounded-full text-sm text-gray-800 hover:bg-gray-100 transition-colors font-light">
							Change Picture
						</button>
					</div>
				</div>

				{/* Form Fields */}
				<div className="space-y-5">
					<div>
						<label className="block text-lg text-gray-700 mb-3">Email</label>
						<input
							type="email"
							value={formData.email}
							onChange={(e) => handleInputChange('email', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
							placeholder="Enter your email"
						/>
					</div>

					<div>
						<label className="block text-lg text-gray-700 mb-3">First name<span className="text-red-500">*</span></label>
						<input
							type="text"
							value={formData.firstName}
							onChange={(e) => handleInputChange('firstName', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
							placeholder="Enter your first name"
						/>
					</div>

					<div>
						<label className="block text-lg text-gray-700 mb-3">Middle name</label>
						<input
							type="text"
							value={formData.middleName}
							onChange={(e) => handleInputChange('middleName', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
							placeholder="Enter your middle name"
						/>
					</div>

					<div>
						<label className="block text-lg text-gray-700 mb-3">Last name<span className="text-red-500">*</span></label>
						<input
							type="text"
							value={formData.lastName}
							onChange={(e) => handleInputChange('lastName', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
							placeholder="Enter your last name"
						/>
					</div>
				</div>

				<button
					onClick={handleSave}
					className="px-6 py-3 bg-gray-800 text-white rounded-full font-semibold text-lg hover:bg-gray-900 transition-colors"
				>
					Save
				</button>
			</div>
		</div>
	);

	const renderPreferencesTab = () => (
		<div className="space-y-5">
			<p className="text-xl text-gray-800 leading-6">
				Customize your experience by adjusting language, region, and voice options to suit your needs.
			</p>
			
			<div className="space-y-5 w-80">
				<div>
					<label className="block text-lg text-gray-700 mb-3">Language</label>
					<div className="relative">
						<select
							value={formData.language}
							onChange={(e) => handleInputChange('language', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 appearance-none text-gray-900"
						>
							<option value="English">Select Language</option>
							<option value="Spanish">Spanish</option>
							<option value="French">French</option>
							<option value="German">German</option>
						</select>
						<ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
					</div>
				</div>

				<div>
					<label className="block text-lg text-gray-700 mb-3">Time Zone</label>
					<div className="relative">
						<select
							value={formData.timeZone}
							onChange={(e) => handleInputChange('timeZone', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 appearance-none text-gray-900"
						>
							<option value="UTC-5 (Eastern Time)">Select Time Zone</option>
							<option value="UTC-6 (Central Time)">UTC-6 (Central Time)</option>
							<option value="UTC-7 (Mountain Time)">UTC-7 (Mountain Time)</option>
							<option value="UTC-8 (Pacific Time)">UTC-8 (Pacific Time)</option>
						</select>
						<ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
					</div>
				</div>

				<div>
					<label className="block text-lg text-gray-700 mb-3">Voice</label>
					<div className="relative">
						<select
							value={formData.voice}
							onChange={(e) => handleInputChange('voice', e.target.value)}
							className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 appearance-none text-gray-900"
						>
							<option value="Default">Select Voice</option>
							<option value="Male">Male</option>
							<option value="Female">Female</option>
							<option value="Neutral">Neutral</option>
						</select>
						<ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
					</div>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-6 py-3 bg-gray-800 text-white rounded-full font-semibold text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderNotificationsTab = () => (
		<div className="space-y-5">
			<p className="text-xl text-gray-800 leading-6">
				Choose how and when you&apos;d like to receive updates, alerts, and promotional messages.
			</p>
			
			<div className="space-y-5">
				{/* Push Notifications */}
				<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
					<div className="flex items-center gap-2">
						<div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center p-2">
							<Image src="/Icons/image 9.png" alt="Push Notification" width={24} height={24} />
						</div>
						<div className="ml-2">
							<h4 className="text-lg text-gray-700 font-normal">Push Notification</h4>
							<p className="text-sm text-gray-500">Get notified about important emails and reminders</p>
						</div>
					</div>
					<CustomCheckbox 
						checked={formData.pushNotifications}
						onChange={(checked) => handleInputChange('pushNotifications', checked)}
					/>
				</div>

				{/* Microphone Access */}
				<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
					<div className="flex items-center gap-2">
						<div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center p-2">
							<Image src="/Icons/image 10.png" alt="Microphone Access" width={24} height={24} />
						</div>
						<div className="ml-2">
							<h4 className="text-lg text-gray-700 font-normal">Microphone Access</h4>
							<p className="text-sm text-gray-500">Use voice commands to interact with Mira</p>
						</div>
					</div>
					<CustomCheckbox 
						checked={formData.microphoneAccess}
						onChange={(checked) => handleInputChange('microphoneAccess', checked)}
					/>
				</div>

				{/* Wake Word Detection */}
				<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
					<div className="flex items-center gap-2">
						<div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center p-2">
							<Image src="/Icons/image 11.png" alt="Wake Word Detection" width={24} height={24} />
						</div>
						<div className="ml-2">
							<h4 className="text-lg text-gray-700 font-normal">Wake Word Detection</h4>
							<p className="text-sm text-gray-500">Activate Mira with your voice</p>
						</div>
					</div>
					<CustomCheckbox 
						checked={formData.wakeWordDetection}
						onChange={(checked) => handleInputChange('wakeWordDetection', checked)}
					/>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-6 py-3 bg-gray-800 text-white rounded-full font-semibold text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderPrivacyTab = () => (
		<div className="space-y-5">
			<p className="text-xl text-gray-800 leading-6">
				Control what information you share and manage how your data is used to keep your account secure.
			</p>
			
			<div className="space-y-8">
				{/* Email Connections */}
				<div>
					<h3 className="text-xl text-gray-800 mb-5">Your Email</h3>
					<div className="space-y-5">
						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 4.png" alt="Gmail" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Gmail</span>
								{connectedEmails.includes("Gmail") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => {
									if (connectedEmails.includes("Gmail")) {
										handleGmailDisconnect();
									} else {
										// Handle connect
										const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
										window.location.href = `${apiBase}/gmail/auth`;
									}
								}}
								className={`px-4 py-2 rounded-lg text-sm transition-colors ${
									connectedEmails.includes("Gmail")
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100"
								}`}
							>
								{connectedEmails.includes("Gmail") ? "Disconnect" : "Connect"}
							</button>
						</div>

						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 5.png" alt="Outlook" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Outlook</span>
								{connectedEmails.includes("Outlook") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => alert("Outlook integration coming soon!")}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div>

						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
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
								onClick={() => alert("Microsoft 365 integration coming soon!")}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div>
					</div>
				</div>

				{/* Calendar Connections */}
				<div>
					<h3 className="text-xl text-gray-800 mb-5">Your Calendar</h3>
					<div className="space-y-5">
						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 7.png" alt="Google Calendar" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Google Calendar</span>
								{connectedCalendars.includes("Google Calendar") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => alert("Google Calendar integration coming soon!")}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div>

						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 5.png" alt="Outlook Calendar" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Outlook Calendar</span>
								{connectedCalendars.includes("Outlook Calendar") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => alert("Outlook Calendar integration coming soon!")}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div>

						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
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
						</div>

						<div className="flex items-center justify-between px-6 py-4 bg-white rounded-lg border border-gray-400">
							<div className="flex items-center gap-5">
								<div className="w-6 h-6 rounded flex items-center justify-center">
									<Image src="/Icons/image 8.png" alt="Exchange Calendar" width={24} height={24} />
								</div>
								<span className="text-lg text-gray-700">Exchange Calendar</span>
								{connectedCalendars.includes("Exchange Calendar") && (
									<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
										Connected
									</span>
								)}
							</div>
							<button 
								onClick={() => alert("Exchange Calendar integration coming soon!")}
								className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
							>
								Connect
							</button>
						</div>
					</div>
				</div>

				{/* Permissions */}
				<div className="space-y-5">
					<div className="flex items-start gap-3">
						<CustomCircularCheckbox 
							checked={formData.emailAccess}
							onChange={(checked) => handleInputChange('emailAccess', checked)}
							className="mt-1"
						/>
						<p className="text-base text-gray-700 leading-5">
							Allow Mira to access your email to read, compose, manage drafts, and send emails from your connected accounts. <a href="#" className="text-gray-500 underline text-sm">Learn more</a>
						</p>
					</div>

					<div className="flex items-start gap-3">
						<CustomCircularCheckbox 
							checked={formData.calendarAccess}
							onChange={(checked) => handleInputChange('calendarAccess', checked)}
							className="mt-1"
						/>
						<p className="text-base text-gray-700 leading-5">
							Allow Mira to access your calendar to view, create, edit, and manage your events and reminders across connected accounts.
						</p>
					</div>

					{/* Privacy Policy Section */}
					<div className="mt-6">
						<p className="text-lg text-gray-800 leading-6">
							<span className="font-bold">Make sure you trust Mira:</span> Review{' '}
							<a href="#" className="text-purple-600 underline">Mira&apos;s Privacy Policy</a> and{' '}
							<a href="#" className="text-purple-600 underline">Terms of Service</a> to understand how Mira will process and protect your data.
						</p>
					</div>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-6 py-3 bg-gray-800 text-white rounded-full font-semibold text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderSubscriptionTab = () => (
		<div className="space-y-5">
			<p className="text-xl text-gray-800 leading-6">
				View your current plan, update billing details, or upgrade your subscription anytime.
			</p>
			
			<div className="space-y-5">
				{/* Plan Selection */}
				<div className="space-y-5">
					<div className={`flex items-center justify-between px-6 py-4 rounded-lg border ${formData.selectedPlan === 'basic' ? 'border-gray-400 bg-gray-50' : 'border-gray-400 bg-white'}`}>
						<div className="flex items-center gap-2">
							<div className="w-10 h-10 rounded flex items-center justify-center">
								<Image src="/Icons/Ellipse 12.svg" alt="Basic Plan" width={40} height={40} />
							</div>
							<div>
								<h4 className="text-lg font-normal text-gray-700">Basic Plan - Free</h4>
								<p className="text-sm text-gray-500">AI assistant managing Email, calendar, and meeting</p>
							</div>
						</div>
						<div className="relative">
							<CustomRadioButton
								name="plan"
								value="basic"
								checked={formData.selectedPlan === 'basic'}
								onChange={(value) => handleInputChange('selectedPlan', value)}
							/>
						</div>
					</div>

					<div className={`flex items-center justify-between px-6 py-4 rounded-lg border ${formData.selectedPlan === 'advanced' ? 'border-gray-400 bg-gray-50' : 'border-gray-400 bg-white'}`}>
						<div className="flex items-center gap-2">
							<div className="w-10 h-10 rounded flex items-center justify-center">
								<Image src="/Icons/Ellipse 10.svg" alt="Advanced Plan" width={40} height={40} />
							</div>
							<div>
								<h4 className="text-lg font-normal text-gray-700">Advanced Plan - $9/month</h4>
								<p className="text-sm text-gray-500">AI assistant with customized voice</p>
							</div>
						</div>
						<div className="relative">
							<CustomRadioButton
								name="plan"
								value="advanced"
								checked={formData.selectedPlan === 'advanced'}
								onChange={(value) => handleInputChange('selectedPlan', value)}
							/>
						</div>
					</div>

					<div className={`flex items-center justify-between px-6 py-4 rounded-lg border ${formData.selectedPlan === 'premium' ? 'border-gray-400 bg-gray-50' : 'border-gray-400 bg-white'}`}>
						<div className="flex items-center gap-2">
							<div className="w-10 h-10 rounded flex items-center justify-center">
								<Image src="/Icons/Ellipse 11.svg" alt="Premium Plan" width={40} height={40} />
							</div>
							<div>
								<h4 className="text-lg font-normal text-gray-700">Premium Plan - $19/month</h4>
								<p className="text-sm text-gray-500">Customized voice AI assistant being able to make appointments for you</p>
							</div>
						</div>
						<div className="relative">
							<CustomRadioButton
								name="plan"
								value="premium"
								checked={formData.selectedPlan === 'premium'}
								onChange={(value) => handleInputChange('selectedPlan', value)}
							/>
						</div>
					</div>
				</div>

				{/* Card Details */}
				<div className="space-y-10">
					<div>
						<h3 className="text-2xl font-medium text-gray-800 mb-2">Card Details</h3>
						<p className="text-lg text-gray-500">Update your card details.</p>
					</div>

					<div className="space-y-5">
						<div>
							<label className="block text-lg text-gray-700 mb-3">Name on card</label>
							<input
								type="text"
								value={formData.cardName}
								onChange={(e) => handleInputChange('cardName', e.target.value)}
								className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
								placeholder="Enter name on card"
							/>
						</div>

						<div className="flex gap-6">
							<div className="flex-1">
								<label className="block text-lg text-gray-700 mb-3">Card number</label>
								<input
									type="text"
									value={formData.cardNumber}
									onChange={(e) => handleInputChange('cardNumber', e.target.value)}
									className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
									placeholder="1234 5678 9012 3456"
								/>
							</div>
							<div className="w-28">
								<label className="block text-lg text-gray-700 mb-3">Exp date</label>
								<input
									type="text"
									value={formData.expDate}
									onChange={(e) => handleInputChange('expDate', e.target.value)}
									className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
									placeholder="MM/YY"
								/>
							</div>
							<div className="w-28">
								<label className="block text-lg text-gray-700 mb-3">CVV</label>
								<input
									type="text"
									value={formData.cvv}
									onChange={(e) => handleInputChange('cvv', e.target.value)}
									className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
									placeholder="123"
								/>
							</div>
						</div>

						<div>
							<label className="block text-lg text-gray-700 mb-3">Address</label>
							<input
								type="text"
								value={formData.address}
								onChange={(e) => handleInputChange('address', e.target.value)}
								className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
								placeholder="Enter your address"
							/>
						</div>

						<div className="flex gap-6">
							<div className="flex-1">
								<label className="block text-lg text-gray-700 mb-3">City</label>
								<input
									type="text"
									value={formData.city}
									onChange={(e) => handleInputChange('city', e.target.value)}
									className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
									placeholder="Enter city"
								/>
							</div>
							<div className="w-28">
								<label className="block text-lg text-gray-700 mb-3">State</label>
								<input
									type="text"
									value={formData.state}
									onChange={(e) => handleInputChange('state', e.target.value)}
									className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
									placeholder="State"
								/>
							</div>
							<div className="w-28">
								<label className="block text-lg text-gray-700 mb-3">Postal code</label>
								<input
									type="text"
									value={formData.postalCode}
									onChange={(e) => handleInputChange('postalCode', e.target.value)}
									className="w-full h-14 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-gray-900 placeholder-gray-500"
									placeholder="12345"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			<button
				onClick={handleSave}
				className="px-6 py-3 bg-gray-800 text-white rounded-full font-semibold text-lg hover:bg-gray-900 transition-colors"
			>
				Save
			</button>
		</div>
	);

	const renderTabContent = () => {
		switch (activeTab) {
			case 'profile':
				return renderProfileTab();
			case 'preferences':
				return renderPreferencesTab();
			case 'notifications':
				return renderNotificationsTab();
			case 'privacy':
				return renderPrivacyTab();
			case 'subscription':
				return renderSubscriptionTab();
			default:
				return renderProfileTab();
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 p-8">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div className="flex items-center gap-8">
					<div className="flex items-center gap-2">
						<span className="text-base text-gray-800">Wed, Oct 15</span>
					</div>
					<div className="flex items-center gap-2 px-3 py-2 bg-white rounded-full border border-gray-200">
						<MapPin className="w-4 h-4 text-gray-600" />
						<span className="text-base text-gray-800">{isLocationLoading ? 'Detecting...' : location}</span>
					</div>
					<div className="flex items-center gap-2 px-3 py-2 bg-white rounded-full border border-gray-200">
						<Sun className="w-6 h-6 text-yellow-500" />
						<span className="text-base text-gray-800">20°</span>
					</div>
				</div>
				<div className="w-11 h-11 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
					<Bell className="w-6 h-6 text-gray-600" />
				</div>
			</div>

			{/* Title */}
			<div className="mb-8">
				<h1 className="text-4xl font-medium text-black">Settings</h1>
			</div>

			{/* Tab Navigation */}
			<div className="flex items-center gap-8 mb-8 border-b border-gray-300">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className={`px-2 py-1 text-xl transition-colors ${
							activeTab === tab.id
								? 'text-gray-800 font-medium border-b-2 border-purple-600 pb-4'
								: 'text-gray-500 font-medium hover:text-gray-700 pb-4'
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Tab Content */}
			<div className="max-w-4xl">
				{renderTabContent()}
			</div>
		</div>
	);
}
