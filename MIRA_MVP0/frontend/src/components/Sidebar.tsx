import { Icon } from "./Icon";
import { MiraLogo } from "./MiraLogo";

interface SidebarProps {
  onNavigate: (path: string) => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Settings", path: "/dashboard/settings" },
    { name: "Reminder", path: "/dashboard/remainder" },
  ];

  return (
    <aside className="bg-[rgba(255,255,255,0.5)] border-r border-[rgba(196,199,204,0.5)] flex flex-col items-center justify-between h-full w-20 p-6">
      {/* Top Section */}
      <div className="flex flex-col items-center gap-6">
        <MiraLogo className="shadow-[0px_0px_10px_0px_#bab2da]" />
        
        <div className="flex flex-col gap-4">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => onNavigate(item.path)}
              className="bg-[#f0f3fa] border border-[#c4c7cc] flex items-center justify-center p-2.5 rounded-lg w-11 h-11 hover:bg-[#e6e9f0] transition-colors"
              title={item.name}
            >
              <Icon name={item.name} size={24} />
            </button>
          ))}
        </div>
      </div>

      {/* Profile Icon */}
      <button
        onClick={() => onNavigate("/dashboard/profile")}
        className="bg-[#f0f3fa] border border-[#c4c7cc] flex items-center justify-center p-2.5 rounded-lg w-11 h-11 hover:bg-[#e6e9f0] transition-colors"
        title="Profile"
      >
        <Icon name="Profile" size={24} />
      </button>
    </aside>
  );
}