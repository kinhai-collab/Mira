import { Sidebar } from "./Sidebar";

interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export function OnboardingHeader({ currentStep, totalSteps, onBack, onNavigate }: OnboardingHeaderProps) {
  return (
    <div className="flex h-screen bg-gradient-to-b from-[#d0c7fa] to-[#fbdbed]">
      {/* Sidebar */}
      <Sidebar onNavigate={onNavigate} />

      {/* Main content */}
      <div className="flex-1 flex justify-center items-start px-4 overflow-y-auto pt-8">
        <div className="w-full max-w-[664px]">
          {/* Header with progress bar */}
          <div className="bg-[#f7f8fa] rounded-t-lg px-8 py-4 mb-0">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={onBack}
                className="flex items-center gap-3 text-[#454547] text-[14px] font-['Outfit',_sans-serif] hover:text-[#272829] transition-colors"
              >
                <div className="w-3 h-6">
                  <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
                    <path d="M10 2L2 12L10 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                Back
              </button>
              <span className="text-[#454547] text-[14px] font-['Outfit',_sans-serif]">
                Step {currentStep} of {totalSteps}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="flex items-center w-full">
              {Array.from({ length: totalSteps }, (_, index) => (
                <div key={index} className="flex-1 flex items-center">
                  <div
                    className={`h-[10px] w-full ${
                      index < currentStep
                        ? "bg-[#735ff8]"
                        : "bg-[#dde4f6]"
                    } ${
                      index === 0
                        ? "rounded-l-lg"
                        : index === totalSteps - 1
                        ? "rounded-r-lg"
                        : ""
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
