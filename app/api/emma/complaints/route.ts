import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  saveComplaint,
  getComplaints,
  logAnalyticsEvent,
} from '@/lib/emma-db';
import { sql } from '@/lib/db';

/**
 * POST /api/emma/complaints - Submit a new complaint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      conversation_id,
      category,
      subject,
      description,
      severity,
      metadata,
    } = body;

    if (!category || !description) {
      return NextResponse.json(
        { error: 'category and description are required' },
        { status: 400 }
      );
    }

    // Auto-detect severity if not provided
    let detectedSeverity = severity;
    if (!detectedSeverity) {
      detectedSeverity = await detectComplaintSeverity(description);
    }

    const complaint = await saveComplaint({
      user_id,
      conversation_id,
      category,
      subject,
      description,
      severity: detectedSeverity,
      metadata,
    });

    // Log analytics
    await logAnalyticsEvent('complaint_submitted', {
      user_id,
      conversation_id,
      event_category: category,
      event_data: {
        severity: detectedSeverity,
        subject,
      },
    });

    // If high severity, could trigger notification (future enhancement)
    if (detectedSeverity === 'high' || detectedSeverity === 'urgent') {
      console.log(`⚠️ HIGH PRIORITY COMPLAINT: ${category} - ${subject}`);
      // Future: Send notification to THA
    }

    return NextResponse.json({ complaint, success: true });
  } catch (error) {
    console.error('Save complaint error:', error);
    return NextResponse.json(
      { error: 'Failed to save complaint' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emma/complaints - Get complaints (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status');
    const severity = request.nextUrl.searchParams.get('severity');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    const complaints = await getComplaints({
      status: status || undefined,
      severity: severity || undefined,
      limit,
    });

    // Get summary stats
    const statsResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE severity = 'urgent') as urgent_count,
        COUNT(*) FILTER (WHERE severity = 'high') as high_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
      FROM emma_complaints
    `;

    const stats = {
      total: Number(statsResult[0].total),
      new: Number(statsResult[0].new_count),
      urgent: Number(statsResult[0].urgent_count),
      high: Number(statsResult[0].high_count),
      this_week: Number(statsResult[0].this_week),
    };

    return NextResponse.json({ complaints, stats });
  } catch (error) {
    console.error('Get complaints error:', error);
    return NextResponse.json(
      { error: 'Failed to get complaints' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/emma/complaints - Update complaint status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { complaint_id, status, resolution } = body;

    if (!complaint_id || !status) {
      return NextResponse.json(
        { error: 'complaint_id and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['new', 'acknowledged', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Update complaint
    if (status === 'resolved' || status === 'closed') {
      await sql`
        UPDATE emma_complaints SET
          status = ${status},
          resolution = ${resolution || null},
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = ${complaint_id}
      `;
    } else {
      await sql`
        UPDATE emma_complaints SET
          status = ${status},
          updated_at = NOW()
        WHERE id = ${complaint_id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update complaint error:', error);
    return NextResponse.json(
      { error: 'Failed to update complaint' },
      { status: 500 }
    );
  }
}

/**
 * Detect complaint severity using AI
 */
async function detectComplaintSeverity(description: string): Promise<'low' | 'medium' | 'high' | 'urgent'> {
  // Quick keyword check first
  const urgentKeywords = ['dangerous', 'unsafe', 'emergency', 'scam', 'stolen', 'theft', 'injured', 'assault'];
  const highKeywords = ['terrible', 'awful', 'worst', 'disgusting', 'never again', 'ripped off', 'fraud'];
  const lowKeywords = ['minor', 'small', 'bit', 'slightly', 'okay but'];
  
  const lowered = description.toLowerCase();
  
  if (urgentKeywords.some(k => lowered.includes(k))) return 'urgent';
  if (highKeywords.some(k => lowered.includes(k))) return 'high';
  if (lowKeywords.some(k => lowered.includes(k))) return 'low';
  
  // Use AI for ambiguous cases
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You assess complaint severity for a tourism board. 
Return ONLY one word: low, medium, high, or urgent.
- urgent: Safety issues, theft, assault, scams
- high: Very bad experiences, health concerns, significant financial loss
- medium: Poor service, misleading info, general disappointment
- low: Minor inconveniences, suggestions for improvement`,
      prompt: description,
      temperature: 0.1,
    });
    
    const severity = text.trim().toLowerCase();
    if (['low', 'medium', 'high', 'urgent'].includes(severity)) {
      return severity as 'low' | 'medium' | 'high' | 'urgent';
    }
    return 'medium';
  } catch {
    return 'medium';
  }
}

/**
 * Extract complaint from conversation message (for auto-detection)
 */
export async function extractComplaintFromMessage(
  message: string,
  context: { userId?: string; conversationId?: string }
): Promise<{ isComplaint: boolean; category?: string; subject?: string; severity?: string } | null> {
  // Quick negative sentiment check
  const negativeIndicators = [
    'disappointed', 'terrible', 'awful', 'worst', 'rip off', 'scam',
    'problem', 'issue', 'complaint', 'frustrated', 'angry', 'upset',
    'never', 'horrible', 'disgusting', 'rude', 'disrespectful'
  ];
  
  const lowered = message.toLowerCase();
  const hasNegative = negativeIndicators.some(i => lowered.includes(i));
  
  if (!hasNegative) {
    return { isComplaint: false };
  }
  
  // Use AI to extract details
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You extract complaint information from tourist messages.
If the message is a complaint, return JSON:
{
  "isComplaint": true,
  "category": "restaurant|beach|activity|transport|accommodation|safety|other",
  "subject": "what/who they're complaining about",
  "severity": "low|medium|high|urgent"
}
If not a complaint, return: {"isComplaint": false}`,
      prompt: message,
      temperature: 0.2,
    });
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { isComplaint: false };
  } catch {
    return { isComplaint: hasNegative, category: 'other' };
  }
}
