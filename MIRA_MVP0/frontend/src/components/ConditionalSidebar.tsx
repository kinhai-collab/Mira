/** @format */
"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function ConditionalSidebar() {
	const pathname = usePathname();

	// Normalize path to ignore trailing slashes
	const normalize = (p: string) => {
		if (!p) return "/";
		return p !== "/" ? p.replace(/\/+$/, "") : "/";
	};

	// Define route prefixes where sidebar should be hidden
	const hidePrefixes = [
		"/login",
		"/signup",
		"/onboarding",
		"/auth",
		"/landing",
	];

	const current = normalize(pathname);

	// Check if current route should hide sidebar (prefix-based)
	const shouldHideSidebar = hidePrefixes.some(
		(prefix) => current === prefix || current.startsWith(prefix + "/")
	);

	// Hide sidebar on specific pages
	if (shouldHideSidebar) {
		return null;
	}

	// Show sidebar elsewhere
	return (
		<aside className="hidden md:flex">
			<Sidebar />
		</aside>
	);
}

// Helper (optional)
export function shouldShowSidebar(pathname: string): boolean {
	const normalize = (p: string) => {
		if (!p) return "/";
		return p !== "/" ? p.replace(/\/+$/, "") : "/";
	};

	const hidePrefixes = [
		"/login",
		"/signup",
		"/onboarding",
		"/auth",
		"/landing",
	];

	const current = normalize(pathname);
	const shouldHide = hidePrefixes.some(
		(prefix) => current === prefix || current.startsWith(prefix + "/")
	);

	return !shouldHide;
}
