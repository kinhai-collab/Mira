/** @format */
import React from "react";
import { Icon } from "@/components/Icon";

interface ConversationResponseCardProps {
	stage: "thinking" | "responding" | "done" | "idle";
	title?: string;
	items?: string[];
	accentColor?: string;
}

const ConversationResponseCard: React.FC<ConversationResponseCardProps> = ({
	stage,
	title = "Preparing your Morning Brief...",
	items = [],
	accentColor = "#6B4EFF",
}) => {
	if (stage === "idle") return null;

	if (stage === "thinking") {
		return (
			<div className="mt-12 flex flex-col items-center justify-center text-gray-700">
				<div className="w-3 h-3 rounded-full bg-[#6B4EFF] animate-pulse mb-3" />
				<p className="text-sm font-medium">Thinking...</p>
			</div>
		);
	}

	if (stage === "responding") {
		return (
			<div className="mt-12 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 w-full max-w-xl text-left">
				<div className="flex items-center gap-2 mb-3">
					<span
						className="w-2.5 h-2.5 rounded-full"
						style={{ backgroundColor: accentColor }}
					/>
					<p className="text-sm font-medium text-gray-800">{title}</p>
				</div>

				<ul className="space-y-2 text-sm text-gray-700">
					{items.map((item, i) => (
						<li key={i} className="flex items-center gap-2">
							<Icon name="CheckCircle" size={14} className="text-[#6B4EFF]" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			</div>
		);
	}

	if (stage === "done") {
		return (
			<div className="mt-12 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 w-full max-w-xl text-left">
				<h3 className="font-semibold text-gray-900 mb-2">
					Prepared Your Morning Brief
				</h3>
				<ul className="space-y-2 text-sm text-gray-700">
					{items.map((item, i) => (
						<li key={i} className="flex items-center gap-2">
							<Icon name="CheckCircle" size={14} className="text-green-500" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			</div>
		);
	}

	return null;
};

export default ConversationResponseCard;
