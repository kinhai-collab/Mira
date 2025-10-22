/** @format */
"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function ConditionalSidebar() {
	const pathname = usePathname();
	
    // Normalize path to ignore trailing slash
    const normalize = (p: string) => {
        if (!p) return "/";
        return p !== "/" ? p.replace(/\/+$/, "") : "/";
    };

    // Define route prefixes where sidebar should be hidden
    const hidePrefixes = [
        "/login",
        "/signup",
        "/onboarding",
        "/auth"
    ];

    const current = normalize(pathname);

    // Check if current route should hide sidebar (prefix-based and robust to trailing slashes)
    const shouldHideSidebar = hidePrefixes.some((prefix) =>
        current === prefix || current.startsWith(prefix + "/")
    );
	
	// Don't render sidebar on login/signup/onboarding pages
	if (shouldHideSidebar) {
		return null;
	}
	
	// Render sidebar for all other pages (dashboard, profile, settings, etc.)
	return (
		<aside className="hidden md:flex">
			<Sidebar />
		</aside>
	);
}

// Export a function to check if sidebar should be shown (for use in layout)
export function shouldShowSidebar(pathname: string): boolean {
    const normalize = (p: string) => {
        if (!p) return "/";
        return p !== "/" ? p.replace(/\/+$/, "") : "/";
    };

    const hidePrefixes = [
        "/login",
        "/signup",
        "/onboarding",
        "/auth"
    ];

    const current = normalize(pathname);
    const shouldHide = hidePrefixes.some((prefix) =>
        current === prefix || current.startsWith(prefix + "/")
    );

    return !shouldHide;
}
