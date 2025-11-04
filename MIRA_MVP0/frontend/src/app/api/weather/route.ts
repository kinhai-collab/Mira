import { NextResponse } from 'next/server';

// Ensure this route is treated as dynamic (server-side) so outbound fetches are allowed
export const dynamic = 'force-dynamic';

// Simple proxy to Open-Meteo to keep third-party calls server-side.
// GET /api/weather?lat=...&lon=...
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing lat or lon query parameter' }, { status: 400 });
    }

    const latitude = Number(lat);
    const longitude = Number(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid lat or lon' }, { status: 400 });
    }

    // Open-Meteo current weather endpoint (no API key required)
    const providerUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      latitude
    )}&longitude=${encodeURIComponent(longitude)}&current_weather=true&temperature_unit=celsius`;

    const resp = await fetch(providerUrl);
    if (!resp.ok) {
      return NextResponse.json({ error: 'Weather provider error', status: resp.status }, { status: 502 });
    }

    const payload = await resp.json();
    const temp = payload?.current_weather?.temperature ?? null;

    const result = {
      temperatureC: typeof temp === 'number' ? temp : null,
      unit: 'C',
      provider: 'open-meteo',
      latitude,
      longitude,
      retrieved_at: new Date().toISOString(),
      // include raw provider payload for debugging (can be removed later)
      raw: payload,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Server /api/weather error:', err);
    return NextResponse.json({ error: 'Internal server error', details: String(err) }, { status: 500 });
  }
}
