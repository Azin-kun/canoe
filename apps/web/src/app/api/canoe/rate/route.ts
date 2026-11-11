import { apiError, apiSuccess } from '@/lib/api-response';
import { getNearRate } from '@/lib/canoe/rate';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const currency = (new URL(request.url).searchParams.get('currency') ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return apiError('currency must be a 3-letter ISO code', 400);
  try {
    return apiSuccess({ rate: await getNearRate(currency) });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Rate unavailable', 503);
  }
}
