"use server";

export async function getReverseGeocode(lat: number, lon: number) {
	try {
		const res = await fetch(
			`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
			{
				headers: {
					"User-Agent": "MiraApp/1.0",
				},
			}
		);

		if (!res.ok) {
			console.error("Nominatim API error:", res.statusText);
			return null;
		}

		const data = await res.json();
		return data;
	} catch (error) {
		console.error("Server action getReverseGeocode error:", error);
		return null;
	}
}
