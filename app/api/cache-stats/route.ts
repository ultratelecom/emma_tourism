import { getCacheStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = await getCacheStats();
    
    // Estimate savings (GPT-4o ~$0.01-0.03 per request)
    const estimatedSavings = stats.total_hits * 0.015; // Conservative estimate at $0.015/request
    
    return new Response(JSON.stringify({
      ...stats,
      estimated_savings_usd: `$${estimatedSavings.toFixed(2)}`,
      message: `Cache has saved approximately ${stats.total_hits} API calls`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get cache stats' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

