import { exchangeToken } from '../../server/stravaToken.js';

// Vercel: tylko POST; inne metody Vercel odrzuca sam.
export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => undefined);
  const result = await exchangeToken(body, process.env);
  return Response.json(result.json, { status: result.status });
}
