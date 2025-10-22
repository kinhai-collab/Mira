/** @format */
"use client";

import { usePathname } from "next/navigation";
import { shouldShowSidebar } from "./ConditionalSidebar";

interface MainContentProps {
	children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
	const pathname = usePathname();
    const showSidebar = shouldShowSidebar(pathname);
	
	return (
		<main className={`flex-1 overflow-y-auto ${showSidebar ? 'ml-0 md:ml-20' : 'ml-0'}`}>
			{children}
		</main>
	);
}
