/** @format */

export async function checkConflicts(token: string, payload: any) {
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/assistant/calendar/check-conflicts`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(payload),
		}
	);

	if (!res.ok) {
		const err = await res.json();
		throw err;
	}
	return res.json();
}

export async function scheduleEvent(token: string, payload: any) {
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/assistant/calendar/schedule`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(payload),
		}
	);

	if (!res.ok) {
		const err = await res.json();
		throw err;
	}
	return res.json();
}

export async function cancelEvent(token: string, payload: any) {
	return fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/calendar/cancel`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(payload),
	}).then((r) => r.json());
}

export async function rescheduleEvent(token: string, payload: any) {
	return fetch(
		`${process.env.NEXT_PUBLIC_API_URL}/assistant/calendar/reschedule`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(payload),
		}
	).then((r) => r.json());
}
