import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    attendees?: string[];
  }) => void;
  initialDate?: Date;
}

export function CalendarModal({ isOpen, onClose, onSave, initialDate }: CalendarModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"meeting" | "team" | "personal">("meeting");
  const [date, setDate] = useState(initialDate || new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  // Reset form when modal opens/closes or initialDate changes
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setType("meeting");
      const baseDate = initialDate || new Date();
      setDate(baseDate);
      
      // Set default times based on initial date (if provided) or current time
      const defaultStart = new Date(baseDate);
      // If initialDate has a specific hour (from time slot click), use it; otherwise round to next 15 min
      if (initialDate && initialDate.getHours() !== undefined) {
        defaultStart.setHours(initialDate.getHours(), 0, 0);
      } else {
        defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 15) * 15); // Round to next 15 min
      }
      const defaultEnd = new Date(defaultStart);
      defaultEnd.setHours(defaultEnd.getHours() + 1);
      
      setStartTime(`${defaultStart.getHours().toString().padStart(2, '0')}:${defaultStart.getMinutes().toString().padStart(2, '0')}`);
      setEndTime(`${defaultEnd.getHours().toString().padStart(2, '0')}:${defaultEnd.getMinutes().toString().padStart(2, '0')}`);
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) {
      alert("Please enter a title for the event");
      return;
    }

    // Construct start and end ISO strings
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const start = new Date(date);
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(date);
    end.setHours(endHour, endMin, 0, 0);

    // Validate that end time is after start time
    if (end <= start) {
      alert("End time must be after start time");
      return;
    }

    // Call onSave - parent will handle async operation and close modal on success
    onSave({
      summary: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      description: type, // Using description to store type for now
    });
  };

  const handleClose = () => {
    setTitle("");
    setType("meeting");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-[443px] p-8 animate-fadeIn">
        {/* Title Input */}
        <input
          type="text"
          placeholder="Add Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-2xl font-medium placeholder-gray-300 border-b border-transparent focus:border-gray-200 focus:outline-none pb-2 mb-6"
          autoFocus
        />

        {/* Type Tabs */}
        <div className="flex gap-4 mb-8">
          {["Meeting", "Team", "Personal"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t.toLowerCase() as "meeting" | "team" | "personal")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                type === t.toLowerCase()
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date and Time */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-gray-700">
            <Icon name="Calendar" size={20} className="text-gray-400" />
            <span className="text-lg">
              {date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          
          <div className="flex items-center gap-3 pl-8">
             <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
                <input 
                    type="time" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="bg-transparent outline-none text-sm font-medium"
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="time" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="bg-transparent outline-none text-sm font-medium"
                />
             </div>
             <span className="text-sm text-gray-400">Time Zone • Does not repeat</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
            <button 
                onClick={handleClose}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-full transition"
            >
                Cancel
            </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-8 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

