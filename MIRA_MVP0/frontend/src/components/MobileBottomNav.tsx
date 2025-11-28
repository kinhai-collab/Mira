"use client";

import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import MobileProfileMenu from "./MobileProfileMenu";

export default function MobileBottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    // Don't show on login, onboarding, landing, or signup pages
    if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/landing") ||
        pathname.startsWith("/signup")
    ) {
        return null;
    }

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F0ECF8] border-t border-gray-200 flex justify-around items-center py-3 z-[9999] px-2">
            {/* 1. Circle (Home) - Mobile only */}
            <button
                onClick={() => router.push("/")}
                className="flex items-center justify-center w-[40px] h-[40px] rounded-full transition-transform active:scale-95"
                style={{
                    background: "linear-gradient(135deg, #E1B5FF 0%, #C4A0FF 100%)",
                    boxShadow: "0px 0px 10px 0px #BAB2DA",
                    opacity: 1,
                }}
            >
                {/* Circle gradient orb */}
            </button>

            {/* 2. Dashboard */}
            <button
                onClick={() => router.push("/dashboard")}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${pathname === "/dashboard" ? "bg-white shadow-sm" : "hover:bg-gray-100"
                    }`}
            >
                <Icon name="Dashboard" size={22} className="text-gray-700" />
            </button>

            {/* 3. Settings */}
            <button
                onClick={() => router.push("/dashboard/settings")}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${pathname.includes("/settings") ? "bg-white shadow-sm" : "hover:bg-gray-100"
                    }`}
            >
                <Icon name="Settings" size={22} className="text-gray-700" />
            </button>

            {/* 4. Reminder (Bell) */}
            <button
                onClick={() => router.push("/dashboard/reminder")}
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${pathname.includes("/reminder") ? "bg-white shadow-sm" : "hover:bg-gray-100"
                    }`}
            >
                <Icon name="Reminder" size={22} className="text-gray-700" />
            </button>

            {/* 5. Profile */}
            <MobileProfileMenu />
        </div>
    );
}
