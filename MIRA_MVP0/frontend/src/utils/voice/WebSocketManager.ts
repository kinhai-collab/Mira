/** @format */

/**
 * WebSocket Manager with automatic reconnection, keepalive pings, and connection state management
 */

export enum ConnectionState {
	CONNECTING = 'CONNECTING',
	OPEN = 'OPEN',
	CLOSED = 'CLOSED',
	RECONNECTING = 'RECONNECTING',
}

interface WebSocketManagerConfig {
	wsUrl: string;
	token: string | null;
	onMessage: (data: unknown) => void;
	onStateChange?: (state: ConnectionState) => void;
	onError?: (error: unknown) => void;
	maxReconnectAttempts?: number;
	initialReconnectDelay?: number;
	pingInterval?: number;
	pongTimeout?: number;
}

export class WebSocketManager {
	private ws: WebSocket | null = null;
	private config: WebSocketManagerConfig;
	private state: ConnectionState = ConnectionState.CLOSED;
	private reconnectAttempts = 0;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private pingTimer: NodeJS.Timeout | null = null;
	private pongTimer: NodeJS.Timeout | null = null;
	private shouldReconnect = true;
	private messageQueue: unknown[] = [];
	
	// Configuration with defaults
	private readonly maxReconnectAttempts: number;
	private readonly initialReconnectDelay: number;
	private readonly pingInterval: number;
	private readonly pongTimeout: number;

	constructor(config: WebSocketManagerConfig) {
		this.config = config;
		this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
		this.initialReconnectDelay = config.initialReconnectDelay ?? 1000;
		this.pingInterval = config.pingInterval ?? 30000; // 30 seconds (reduced frequency)
		this.pongTimeout = config.pongTimeout ?? 20000; // 20 seconds (increased tolerance for slow responses)
	}

	/**
	 * Start the WebSocket connection
	 */
	public async connect(): Promise<void> {
		if (this.ws && (this.state === ConnectionState.OPEN || this.state === ConnectionState.CONNECTING)) {
			console.log('⚠️ WebSocket already connected or connecting');
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
		// Don't connect if page is unloading (hot-reload or navigation)
		if (typeof document !== 'undefined' && document.readyState === 'unloading') {
			console.warn('⚠️ Skipping WebSocket connection - page unloading');
			this.shouldReconnect = false;
			return;
		}
		
		try {
			this.updateState(ConnectionState.CONNECTING);
			console.log('🔌 Connecting to WebSocket...', this.config.wsUrl);

			// Build URL with token if provided
			let url = this.config.wsUrl;
			if (this.config.token) {
				const separator = url.includes('?') ? '&' : '?';
				url = `${url}${separator}token=${this.config.token}`;
			}

			this.ws = new WebSocket(url);

			this.ws.onopen = () => {
				console.log('✅ WebSocket connected');
				this.reconnectAttempts = 0;
				this.updateState(ConnectionState.OPEN);
				this.startKeepalive();
				this.flushMessageQueue();
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					
					// Handle pong response
					if (data.message_type === 'pong') {
						console.debug('🏓 Pong received');
						this.clearPongTimer();
						return;
					}

					// Forward all other messages
					this.config.onMessage(data);
				} catch (err) {
					console.error('❌ Failed to parse WebSocket message:', err);
				}
			};

			this.ws.onerror = (error) => {
				console.error('❌ WebSocket error:', error);
				if (this.config.onError) {
					this.config.onError(error);
				}
			};

			this.ws.onclose = (event) => {
				console.log('🔌 WebSocket closed:', {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean,
				});
				
				this.stopKeepalive();
				this.updateState(ConnectionState.CLOSED);

				// Attempt reconnection if enabled
				if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
					this.scheduleReconnect();
				} else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
					console.error('❌ Max reconnection attempts reached. Please reconnect manually.');
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

		console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
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
				console.debug('🏓 Sending ping');
				this.send({ message_type: 'ping' });
				
				// Set pong timeout
				this.pongTimer = setTimeout(() => {
					console.warn('⚠️ Pong timeout - connection appears dead, reconnecting...');
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
			console.warn('⚠️ WebSocket not open, buffering message');
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
		} else {
			console.warn('⚠️ WebSocket not open, cannot send binary data');
		}
	}

	/**
	 * Flush buffered messages when connection is restored
	 */
	private flushMessageQueue(): void {
		if (this.messageQueue.length > 0) {
			console.log(`📤 Flushing ${this.messageQueue.length} buffered messages`);
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
		console.log('🔄 Forcing reconnection...');
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
	}

	/**
	 * Update connection state and notify listeners
	 */
	private updateState(newState: ConnectionState): void {
		if (this.state !== newState) {
			this.state = newState;
			console.log(`🔄 Connection state: ${newState}`);
			
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
		console.log('🗑️ Message queue cleared');
	}
}
