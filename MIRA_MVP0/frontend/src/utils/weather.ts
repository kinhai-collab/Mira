/**
 * Weather utility for fetching current weather data from Open-Meteo API
 * This calls the API directly from the frontend since no API key is required
 *
 * @format
 */

interface OpenMeteoResponse {
	current_weather?: {
		temperature?: number;
		weathercode?: number;
		windspeed?: number;
		winddirection?: number;
		time?: string;
	};
}

export interface WeatherData {
	temperatureC: number | null;
	unit: string;
	provider: string;
	latitude: number;
	longitude: number;
	retrieved_at: string;
	raw?: OpenMeteoResponse;
}

export async function getWeather(
	lat: number,
	lon: number
): Promise<WeatherData> {
	try {
		if (Number.isNaN(lat) || Number.isNaN(lon)) {
			throw new Error("Invalid latitude or longitude");
		}

		// Open-Meteo current weather endpoint (no API key required)
		const providerUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
			lat
		)}&longitude=${encodeURIComponent(
			lon
		)}&current_weather=true&temperature_unit=celsius`;

		const resp = await fetch(providerUrl);
		if (!resp.ok) {
			throw new Error(`Weather provider error: ${resp.status}`);
		}

		const payload = await resp.json();
		const temp = payload?.current_weather?.temperature ?? null;

		return {
			temperatureC: typeof temp === "number" ? temp : null,
			unit: "C",
			provider: "open-meteo",
			latitude: lat,
			longitude: lon,
			retrieved_at: new Date().toISOString(),
			raw: payload,
		};
	} catch (err) {
		console.error("Weather fetch error:", err);
		throw err;
	}
}
