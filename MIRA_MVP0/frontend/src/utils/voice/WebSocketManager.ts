/** @format */

/**
 * WebSocket Manager with automatic reconnection, keepalive pings, and connection state management
 * Optimized for voice pipeline with low-latency requirements
 */

export enum ConnectionState {
	CONNECTING = 'CONNECTING',
	OPEN = 'OPEN',
	CLOSED = 'CLOSED',
	RECONNECTING = 'RECONNECTING',
	ERROR = 'ERROR',
}

interface WebSocketManagerConfig {
	wsUrl: string;
	token: string | null;
	onMessage: (data: unknown) => void;
	onStateChange?: (state: ConnectionState) => void;
	onError?: (error: unknown) => void;
	onConnectionLost?: () => void;
	onConnectionRestored?: () => void;
	maxReconnectAttempts?: number;
	initialReconnectDelay?: number;
	pingInterval?: number;
	pongTimeout?: number;
	connectTimeout?: number;
}

export class WebSocketManager {
	private ws: WebSocket | null = null;
	private config: WebSocketManagerConfig;
	private state: ConnectionState = ConnectionState.CLOSED;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private pongTimer: ReturnType<typeof setTimeout> | null = null;
	private connectTimer: ReturnType<typeof setTimeout> | null = null;
	private shouldReconnect = true;
	private messageQueue: unknown[] = [];
	private wasConnected = false; // Track if we ever connected successfully
	private lastMessageTime = 0;
	
	// Configuration with defaults
	private readonly maxReconnectAttempts: number;
	private readonly initialReconnectDelay: number;
	private readonly pingInterval: number;
	private readonly pongTimeout: number;
	private readonly connectTimeout: number;

	constructor(config: WebSocketManagerConfig) {
		this.config = config;
		this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
		this.initialReconnectDelay = config.initialReconnectDelay ?? 1000;
		this.pingInterval = config.pingInterval ?? 25000; // 25 seconds
		this.pongTimeout = config.pongTimeout ?? 15000; // 15 seconds
		this.connectTimeout = config.connectTimeout ?? 10000; // 10 seconds connect timeout
	}

	/**
	 * Start the WebSocket connection
	 */
	public async connect(): Promise<void> {
		if (this.ws && (this.state === ConnectionState.OPEN || this.state === ConnectionState.CONNECTING)) {
			return;
		}

		this.shouldReconnect = true;
		this.reconnectAttempts = 0;
		await this.createConnection();
	}

	/**
	 * Create a new WebSocket connection
	 */
	private async createConnection(): Promise<void> {
		// Don't connect if document is not ready
		if (typeof document !== 'undefined' && document.readyState === 'loading') {
			return;
		}
		
		// Clear any existing connect timeout
		if (this.connectTimer) {
			clearTimeout(this.connectTimer);
			this.connectTimer = null;
		}
		
		try {
			this.updateState(ConnectionState.CONNECTING);

			// Build URL with token if provided
			let url = this.config.wsUrl;
			if (this.config.token) {
				const separator = url.includes('?') ? '&' : '?';
				url = `${url}${separator}token=${this.config.token}`;
			}

			this.ws = new WebSocket(url);
			
			// Set connect timeout
			this.connectTimer = setTimeout(() => {
				if (this.state === ConnectionState.CONNECTING) {
					console.warn('⏱️ WebSocket connect timeout');
					try { this.ws?.close(); } catch { /* ignore */ }
					this.updateState(ConnectionState.ERROR);
					if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
						this.scheduleReconnect();
					}
				}
			}, this.connectTimeout);

			this.ws.onopen = () => {
				// Clear connect timeout
				if (this.connectTimer) {
					clearTimeout(this.connectTimer);
					this.connectTimer = null;
				}
				
				this.reconnectAttempts = 0;
				this.lastMessageTime = Date.now();
				
				// Notify if this is a reconnection
				if (this.wasConnected && this.config.onConnectionRestored) {
					this.config.onConnectionRestored();
				}
				this.wasConnected = true;
				
				this.updateState(ConnectionState.OPEN);
				this.startKeepalive();
				this.flushMessageQueue();
			};

			this.ws.onmessage = (event) => {
				this.lastMessageTime = Date.now();
				
				try {
					const data = JSON.parse(event.data);
					
					// Handle pong response
					if (data.message_type === 'pong') {
						this.clearPongTimer();
						return;
					}

					// Forward all other messages
					this.config.onMessage(data);
				} catch (err) {
					// Forward raw data if JSON parse fails
					this.config.onMessage(event.data);
				}
			};

			this.ws.onerror = (error) => {
				console.error('❌ WebSocket error:', error);
				if (this.config.onError) {
					this.config.onError(error);
				}
			};

			this.ws.onclose = (event) => {
				// Clear connect timeout
				if (this.connectTimer) {
					clearTimeout(this.connectTimer);
					this.connectTimer = null;
				}
				
				this.stopKeepalive();
				
				// Notify if connection was lost unexpectedly
				if (this.wasConnected && !event.wasClean && this.config.onConnectionLost) {
					this.config.onConnectionLost();
				}
				
				this.updateState(ConnectionState.CLOSED);

				// Attempt reconnection if enabled
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.scheduleReconnect();
				} else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
					console.error('❌ Max reconnection attempts reached. Please reconnect manually.');
					this.updateState(ConnectionState.ERROR);
				}
			};

		} catch (err) {
			console.error('❌ Failed to create WebSocket:', err);
			if (this.config.onError) {
				this.config.onError(err);
			}
			
			if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
				this.scheduleReconnect();
			}
		}
	}

	/**
	 * Schedule a reconnection attempt with exponential backoff
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		this.reconnectAttempts++;
		const delay = Math.min(
			this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
			30000 // Cap at 30 seconds
		);

		this.updateState(ConnectionState.RECONNECTING);

		this.reconnectTimer = setTimeout(() => {
			this.createConnection();
		}, delay);
	}

	/**
	 * Start keepalive ping/pong mechanism
	 */
	private startKeepalive(): void {
		this.stopKeepalive();

		this.pingTimer = setInterval(() => {
			if (this.state === ConnectionState.OPEN && this.ws) {
				this.send({ message_type: 'ping' });
				
				// Set pong timeout
				this.pongTimer = setTimeout(() => {
					this.forceReconnect();
				}, this.pongTimeout);
			}
		}, this.pingInterval);
	}

	/**
	 * Stop keepalive timers
	 */
	private stopKeepalive(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}
		this.clearPongTimer();
	}

	/**
	 * Clear pong timeout timer
	 */
	private clearPongTimer(): void {
		if (this.pongTimer) {
			clearTimeout(this.pongTimer);
			this.pongTimer = null;
		}
	}

	/**
	 * Send a message through the WebSocket
	 */
	public send(data: unknown): void {
		if (this.state === ConnectionState.OPEN && this.ws) {
			try {
				const message = typeof data === 'string' ? data : JSON.stringify(data);
				this.ws.send(message);
			} catch (err) {
				console.error('❌ Failed to send WebSocket message:', err);
			}
		} else {
			// Buffer message if not connected
			this.messageQueue.push(data);
		}
	}

	/**
	 * Send binary data through the WebSocket
	 */
	public sendBinary(data: ArrayBuffer | Blob): void {
		if (this.state === ConnectionState.OPEN && this.ws) {
			try {
				this.ws.send(data);
			} catch (err) {
				console.error('❌ Failed to send binary WebSocket message:', err);
			}
		}
	}

	/**
	 * Flush buffered messages when connection is restored
	 */
	private flushMessageQueue(): void {
		if (this.messageQueue.length > 0) {
			while (this.messageQueue.length > 0) {
				const msg = this.messageQueue.shift();
				this.send(msg);
			}
		}
	}

	/**
	 * Force an immediate reconnection (e.g., manual reconnect button)
	 */
	public forceReconnect(): void {
		this.reconnectAttempts = 0; // Reset counter for manual reconnect
		this.close(false);
		this.connect();
	}

	/**
	 * Close the WebSocket connection
	 */
	public close(permanent = true): void {
		this.shouldReconnect = !permanent;
		
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		
		if (this.connectTimer) {
			clearTimeout(this.connectTimer);
			this.connectTimer = null;
		}

		this.stopKeepalive();

		if (this.ws) {
			try {
				this.ws.close(1000, 'Client closing connection');
			} catch (err) {
				console.error('❌ Error closing WebSocket:', err);
			}
			this.ws = null;
		}

		this.updateState(ConnectionState.CLOSED);
		
		// Clear message queue on permanent close
		if (permanent) {
			this.messageQueue = [];
			this.wasConnected = false;
		}
	}

	/**
	 * Update connection state and notify listeners
	 */
	private updateState(newState: ConnectionState): void {
		if (this.state !== newState) {
			this.state = newState;
			if (this.config.onStateChange) {
				this.config.onStateChange(newState);
			}
		}
	}

	/**
	 * Get current connection state
	 */
	public getState(): ConnectionState {
		return this.state;
	}

	/**
	 * Check if WebSocket is ready to send messages
	 */
	public isReady(): boolean {
		return this.state === ConnectionState.OPEN;
	}

	/**
	 * Clear the message queue
	 */
	public clearQueue(): void {
		this.messageQueue = [];
	}

	/**
	 * Get connection health metrics
	 */
	public getHealthMetrics(): {
		state: ConnectionState;
		reconnectAttempts: number;
		lastMessageTime: number;
		queuedMessages: number;
		timeSinceLastMessage: number;
	} {
		return {
			state: this.state,
			reconnectAttempts: this.reconnectAttempts,
			lastMessageTime: this.lastMessageTime,
			queuedMessages: this.messageQueue.length,
			timeSinceLastMessage: this.lastMessageTime > 0 ? Date.now() - this.lastMessageTime : -1,
		};
	}

	/**
	 * Check if the connection is healthy (receiving messages)
	 */
	public isHealthy(): boolean {
		if (this.state !== ConnectionState.OPEN) return false;
		if (this.lastMessageTime === 0) return true; // Just connected
		
		// Consider unhealthy if no message for 2x ping interval
		const unhealthyThreshold = this.pingInterval * 2;
		return Date.now() - this.lastMessageTime < unhealthyThreshold;
	}
}
