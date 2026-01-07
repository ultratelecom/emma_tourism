import { NextRequest, NextResponse } from 'next/server';
import { clearAllCache, clearCacheByKeyword } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();

    if (keyword) {
      // Clear cache for specific keyword
      await clearCacheByKeyword(keyword);
      return NextResponse.json({
        success: true,
        message: `Cleared cache for questions containing "${keyword}"`
      });
    } else {
      // Clear all cache
      await clearAllCache();
      return NextResponse.json({
        success: true,
        message: 'Cleared all cached responses'
      });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
