import { NextRequest, NextResponse } from 'next/server';
import {
  createUser,
  getUserByEmail,
  getUserByBrowserFingerprint,
  getOrCreateBrowserSession,
  linkBrowserToUser,
  recordUserVisit,
  buildUserContext,
  getUserMemories,
  getUserRatings,
  logAnalyticsEvent,
} from '@/lib/emma-db';

/**
 * POST /api/emma/user - Identify or create a user
 * 
 * This endpoint handles:
 * 1. Browser fingerprint recognition (returning device)
 * 2. Email recognition (returning user)
 * 3. New user creation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { browser_fingerprint, email, name, arrival_method, user_agent, ip_address } = body;

    if (!browser_fingerprint) {
      return NextResponse.json({ error: 'Browser fingerprint required' }, { status: 400 });
    }

    // Step 1: Check browser session
    const browserSession = await getOrCreateBrowserSession(
      browser_fingerprint,
      user_agent || request.headers.get('user-agent') || undefined,
      ip_address || request.headers.get('x-forwarded-for')?.split(',')[0] || undefined
    );

    // Step 2: Try to identify user by browser fingerprint
    let user = await getUserByBrowserFingerprint(browser_fingerprint);
    let isReturningUser = false;
    let isReturningDevice = false;

    if (user) {
      // Known user returning on same device
      isReturningUser = true;
      isReturningDevice = true;
      await recordUserVisit(user.id);
      
      await logAnalyticsEvent('returning_user_device', {
        user_id: user.id,
        event_data: { browser_fingerprint }
      });
    } else if (email) {
      // Step 3: Try to identify by email
      user = await getUserByEmail(email);
      
      if (user) {
        // Known user on new device
        isReturningUser = true;
        isReturningDevice = false;
        await recordUserVisit(user.id);
        await linkBrowserToUser(browser_fingerprint, user.id);
        
        await logAnalyticsEvent('returning_user_new_device', {
          user_id: user.id,
          event_data: { browser_fingerprint, email }
        });
      } else if (name) {
        // Step 4: Create new user
        user = await createUser({
          email,
          name,
          arrival_method,
        });
        await linkBrowserToUser(browser_fingerprint, user.id);
        
        await logAnalyticsEvent('new_user_created', {
          user_id: user.id,
          event_data: { email, name, arrival_method }
        });
      }
    }

    // Build response
    const response: {
      user: typeof user | null;
      browser_session_id: string;
      is_returning_user: boolean;
      is_returning_device: boolean;
      context?: string;
      memories?: Awaited<ReturnType<typeof getUserMemories>>;
      ratings?: Awaited<ReturnType<typeof getUserRatings>>;
    } = {
      user,
      browser_session_id: browserSession.id,
      is_returning_user: isReturningUser,
      is_returning_device: isReturningDevice,
    };

    // Include context for returning users
    if (user && isReturningUser) {
      response.context = await buildUserContext(user.id);
      response.memories = await getUserMemories(user.id, { limit: 5 });
      response.ratings = await getUserRatings(user.id, 5);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('User identification error:', error);
    return NextResponse.json(
      { error: 'Failed to identify user' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emma/user?email=xxx - Check if user exists
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    const fingerprint = request.nextUrl.searchParams.get('fingerprint');

    if (!email && !fingerprint) {
      return NextResponse.json({ error: 'Email or fingerprint required' }, { status: 400 });
    }

    let user = null;
    let source = '';

    if (fingerprint) {
      user = await getUserByBrowserFingerprint(fingerprint);
      source = 'fingerprint';
    }
    
    if (!user && email) {
      user = await getUserByEmail(email);
      source = 'email';
    }

    if (user) {
      return NextResponse.json({
        exists: true,
        source,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          visit_count: user.visit_count,
          last_seen_at: user.last_seen_at,
          personality_tags: user.personality_tags,
        },
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error('User lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup user' },
      { status: 500 }
    );
  }
}
