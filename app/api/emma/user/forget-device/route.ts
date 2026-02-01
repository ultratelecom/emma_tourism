import { NextRequest, NextResponse } from 'next/server';
import { unlinkBrowserFromUser } from '@/lib/emma-db';

/**
 * POST /api/emma/user/forget-device - Unlink this device from the current user.
 * Used when user says "No, someone else" so Emma treats this session as a new person.
 * Next identifyUser by fingerprint will return no user until they identify by email again.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { browser_fingerprint } = body;

    if (!browser_fingerprint) {
      return NextResponse.json({ error: 'Browser fingerprint required' }, { status: 400 });
    }

    await unlinkBrowserFromUser(browser_fingerprint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Forget device error:', error);
    return NextResponse.json(
      { error: 'Failed to forget device' },
      { status: 500 }
    );
  }
}
