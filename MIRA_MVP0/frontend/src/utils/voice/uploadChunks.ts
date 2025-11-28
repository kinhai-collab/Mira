import { getValidToken } from "@/utils/auth";

/**
 * Upload a Blob/File to the backend in fixed-size chunks (default 4096 bytes).
 * Each chunk is sent as multipart/form-data with field `audio`.
 * By default metadata/history are attached to the first chunk (set sendMetaOnFirstChunk=false to send every chunk).
 */
export async function uploadAudioInChunks(
	file: Blob | File,
	options: {
		endpoint?: string;
		chunkSize?: number;
		token?: string | null;
		metadata?: Record<string, any>;
		history?: any[];
		sendMetaOnFirstChunk?: boolean;
		onProgress?: (sentBytes: number, totalBytes: number) => void;
	} = {}
): Promise<any> {
	const {
		endpoint,
		chunkSize = 4096,
		token = null,
		metadata = {},
		history = [],
		sendMetaOnFirstChunk = true,
		onProgress,
	} = options;

	// HTTP chunk uploads are disabled by default to avoid using legacy voice endpoints.
	// Require an explicit `endpoint` if you really intend to use HTTP chunk uploads.
	if (!endpoint) {
		throw new Error('uploadAudioInChunks (HTTP) is disabled — use WebSocket sendBlobOnce or provide an explicit endpoint');
	}
	const url = endpoint.replace(/\/+$/, "");

	// Try to obtain a token if not provided
	let authToken = token;
	if (!authToken) {
		try {
			authToken = await getValidToken();
		} catch (e) {
			console.warn("uploadAudioInChunks: failed to get token:", e);
		}
	}

	const totalSize = file.size;
	const totalChunks = Math.max(1, Math.ceil(totalSize / chunkSize));
	let offset = 0;
	let lastJson: any = null;
	let sentBytes = 0;

	for (let idx = 0; offset < totalSize; idx++) {
		const end = Math.min(offset + chunkSize, totalSize);
		const chunk = file.slice(offset, end);

		const form = new FormData();
		const filename = file instanceof File && file.name ? file.name : "audio.bin";
		form.append("audio", chunk, `${filename}.part${idx}`);
		form.append("chunkIndex", String(idx));
		form.append("totalChunks", String(totalChunks));

		if (sendMetaOnFirstChunk) {
			if (idx === 0) {
				form.append("metadata", JSON.stringify(metadata || {}));
				form.append("history", JSON.stringify(history || []));
			}
		} else {
			form.append("metadata", JSON.stringify(metadata || {}));
			form.append("history", JSON.stringify(history || []));
		}

		const headers: Record<string, string> = {};
		if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

		try {
			const res = await fetch(url, {
				method: "POST",
				headers,
				body: form,
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				console.error("Chunk upload failed", res.status, res.statusText, text);
				throw new Error(`Chunk upload failed: ${res.status} ${res.statusText}`);
			}

			try {
				lastJson = await res.json();
			} catch (e) {
				lastJson = null;
			}

			sentBytes = end;
			if (onProgress) onProgress(sentBytes, totalSize);
		} catch (err) {
			console.error("uploadAudioInChunks error on chunk", idx, err);
			throw err;
		}

		offset = end;
	}

	return lastJson;
}
