/** @format */
'use client';

import { useEffect, useState } from 'react';
import { ConnectionState } from '@/utils/voice/WebSocketManager';

interface ConnectionStatusProps {
	state: ConnectionState;
	onReconnect?: () => void;
}

export default function ConnectionStatus({ state, onReconnect }: ConnectionStatusProps) {
	const [showReconnectButton, setShowReconnectButton] = useState(false);

	useEffect(() => {
		// Show reconnect button after 5 seconds of being closed/reconnecting
		if (state === ConnectionState.CLOSED || state === ConnectionState.RECONNECTING) {
			const timer = setTimeout(() => {
				setShowReconnectButton(true);
			}, 5000);
			return () => clearTimeout(timer);
		} else {
			setShowReconnectButton(false);
		}
	}, [state]);

	const getStatusConfig = () => {
		switch (state) {
			case ConnectionState.OPEN:
				return {
					color: 'bg-green-500',
					text: 'Connected',
					textColor: 'text-green-700',
					bgColor: 'bg-green-50',
					border: 'border-green-200',
				};
			case ConnectionState.CONNECTING:
				return {
					color: 'bg-yellow-500',
					text: 'Connecting...',
					textColor: 'text-yellow-700',
					bgColor: 'bg-yellow-50',
					border: 'border-yellow-200',
				};
			case ConnectionState.RECONNECTING:
				return {
					color: 'bg-orange-500',
					text: 'Reconnecting...',
					textColor: 'text-orange-700',
					bgColor: 'bg-orange-50',
					border: 'border-orange-200',
				};
			case ConnectionState.CLOSED:
				return {
					color: 'bg-red-500',
					text: 'Disconnected',
					textColor: 'text-red-700',
					bgColor: 'bg-red-50',
					border: 'border-red-200',
				};
			default:
				return {
					color: 'bg-gray-500',
					text: 'Unknown',
					textColor: 'text-gray-700',
					bgColor: 'bg-gray-50',
					border: 'border-gray-200',
				};
		}
	};

	const config = getStatusConfig();

	// Don't show anything when connected
	if (state === ConnectionState.OPEN) {
		return null;
	}

	return (
		<div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg border ${config.bgColor} ${config.border} flex items-center gap-3 shadow-lg`}>
			<div className="flex items-center gap-2">
				<div className={`w-2 h-2 rounded-full ${config.color} ${state === ConnectionState.CONNECTING || state === ConnectionState.RECONNECTING ? 'animate-pulse' : ''}`} />
				<span className={`text-sm font-medium ${config.textColor}`}>
					{config.text}
				</span>
			</div>
			
			{showReconnectButton && onReconnect && (
				<button
					onClick={onReconnect}
					className="ml-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
				>
					Reconnect
				</button>
			)}
		</div>
	);
}
