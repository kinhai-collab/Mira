interface MiraLogoProps {
  className?: string;
}

export function MiraLogo({ className = "" }: MiraLogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative w-10 h-10 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-300 rounded-full shadow-[0px_0px_10px_0px_#bab2da]"></div>
        <div className="absolute inset-1 bg-gradient-to-br from-purple-300 to-pink-200 rounded-full"></div>
      </div>
    </div>
  );
}
