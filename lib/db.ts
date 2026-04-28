import { neon } from '@neondatabase/serverless';

// Create a SQL query function. Neon serverless uses fetch under the hood;
// local/dev networks occasionally throw transient DNS/fetch failures
// (e.g. ENOTFOUND api.<region>.aws.neon.tech). Retrying those prevents a
// single flaky lookup from turning an Ava turn into a 500 after the user
// already sent a message.
const rawSql = neon(process.env.DATABASE_URL!);

function isTransientDbError(err: unknown): boolean {
  const message = err instanceof Error ? `${err.message} ${(err as Error & { cause?: unknown }).cause ?? ''}` : String(err);
  return /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network/i.test(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type NeonSql = typeof rawSql;
type RetryingSql = NeonSql;

async function retryQuery<T>(operation: () => Promise<T>): Promise<T> {
  const delays = [0, 250, 750];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await wait(delays[i]);
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || i === delays.length - 1) throw err;
    }
  }
  throw lastErr;
}

const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) =>
  retryQuery(() => rawSql(strings, ...values))) as RetryingSql;

// Preserve Neon's `.unsafe()` API used by migration scripts. It returns
// Neon's UnsafeRawSql object rather than a Promise, so we cannot wrap it
// with retryQuery without changing its type/semantics.
sql.unsafe = rawSql.unsafe;

export interface Chat {
  id: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: number;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

// Create a new chat
export async function createChat(id: string, title?: string): Promise<Chat> {
  const result = await sql`
    INSERT INTO chats (id, title)
    VALUES (${id}, ${title || null})
    RETURNING *
  `;
  return result[0] as Chat;
}

// Get a chat by ID
export async function getChat(id: string): Promise<Chat | null> {
  const result = await sql`
    SELECT * FROM chats WHERE id = ${id}
  `;
  return result[0] as Chat || null;
}

// Update chat title and updated_at
export async function updateChat(id: string, title: string): Promise<void> {
  await sql`
    UPDATE chats 
    SET title = ${title}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

// Update chat's updated_at timestamp
export async function touchChat(id: string): Promise<void> {
  await sql`
    UPDATE chats SET updated_at = NOW() WHERE id = ${id}
  `;
}

// Add a message to a chat
export async function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<Message> {
  const result = await sql`
    INSERT INTO messages (chat_id, role, content)
    VALUES (${chatId}, ${role}, ${content})
    RETURNING *
  `;
  // Also update the chat's updated_at
  await touchChat(chatId);
  return result[0] as Message;
}

// Get all messages for a chat
export async function getMessages(chatId: string): Promise<Message[]> {
  const result = await sql`
    SELECT * FROM messages 
    WHERE chat_id = ${chatId}
    ORDER BY created_at ASC
  `;
  return result as Message[];
}

// Delete a chat and all its messages
export async function deleteChat(id: string): Promise<void> {
  await sql`DELETE FROM chats WHERE id = ${id}`;
}

// ============================================
// RESPONSE CACHING
// ============================================

export interface CachedResponse {
  id: number;
  question_hash: string;
  question_original: string;
  response: string;
  hit_count: number;
  created_at: Date;
  last_accessed_at: Date;
}

/**
 * Normalize a question for consistent cache matching
 * "What are the THA's powers?" → "what are the tha powers"
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if a cached response exists for this question
 */
export async function getCachedResponse(question: string): Promise<CachedResponse | null> {
  const hash = normalizeQuestion(question);
  
  const result = await sql`
    SELECT * FROM cached_responses 
    WHERE question_hash = ${hash}
  `;
  
  if (result.length > 0) {
    // Update hit count and last accessed time
    await sql`
      UPDATE cached_responses 
      SET hit_count = hit_count + 1, last_accessed_at = NOW()
      WHERE question_hash = ${hash}
    `;
    return result[0] as CachedResponse;
  }
  
  return null;
}

/**
 * Save a response to the cache
 */
export async function saveCachedResponse(
  question: string,
  response: string
): Promise<CachedResponse> {
  const hash = normalizeQuestion(question);
  
  const result = await sql`
    INSERT INTO cached_responses (question_hash, question_original, response)
    VALUES (${hash}, ${question}, ${response})
    ON CONFLICT (question_hash) DO UPDATE 
    SET response = ${response}, last_accessed_at = NOW()
    RETURNING *
  `;
  
  return result[0] as CachedResponse;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  total_cached: number;
  total_hits: number;
  top_questions: Array<{ question: string; hits: number }>;
}> {
  const stats = await sql`
    SELECT
      COUNT(*) as total_cached,
      COALESCE(SUM(hit_count), 0) as total_hits
    FROM cached_responses
  `;

  const topQuestions = await sql`
    SELECT question_original as question, hit_count as hits
    FROM cached_responses
    ORDER BY hit_count DESC
    LIMIT 10
  `;

  return {
    total_cached: Number(stats[0].total_cached),
    total_hits: Number(stats[0].total_hits),
    top_questions: topQuestions as Array<{ question: string; hits: number }>,
  };
}

/**
 * Clear all cached responses (for emergency cache clearing)
 */
export async function clearAllCache(): Promise<void> {
  await sql`DELETE FROM cached_responses`;
}

/**
 * Clear cache for specific questions containing certain keywords
 */
export async function clearCacheByKeyword(keyword: string): Promise<void> {
  await sql`
    DELETE FROM cached_responses
    WHERE question_original ILIKE ${'%' + keyword + '%'}
  `;
}

export { sql };

