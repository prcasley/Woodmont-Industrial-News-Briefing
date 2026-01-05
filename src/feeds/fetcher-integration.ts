/**
 * FETCHER INTEGRATION LAYER
 * 
 * This module integrates the unified feed processing pipeline with the existing
 * fetcher.ts architecture. It maintains backward compatibility while leveraging
 * the new 5-stage pipeline approach.
 * 
 * Architecture:
 * ============
 * OLD (fetcher.ts):
 *   - fetchRSSFeedImproved() handles: fetch, parse, classify (all in one)
 *   - fetchAllRSSArticles() orchestrates all feeds
 * 
 * NEW (pipeline.ts + this module):
 *   - Stage 1: parseSourceFeed() - Fetch & parse with error handling
 *   - Stage 2: normalizeArticle() - Standardized format
 *   - Stage 3: dedupeArticles() - Cross-feed deduplication
 *   - Stage 4: classifyArticlesInBatch() - Batch classification
 *   - Stage 5: processFeedsFullPipeline() - Orchestrates all stages
 * 
 * Benefits of this integration:
 * - Cleaner separation of concerns
 * - Unified deduplication across all feeds
 * - More testable (each stage is independent)
 * - Better error handling and logging
 * - Maintains all existing circuit breaker logic
 */

import { RSS_FEEDS } from './config.js';
import { processFeedsFullPipeline, RawArticle, ParsedFeed } from './pipeline.js';
import { classifyArticle } from '../filter/classifier.js';
import { itemStore, feedStats, manualArticles, archiveOldArticles } from '../store/storage.js';
import { FetchResult, NormalizedItem } from '../types/index.js';

// ============================================
// CIRCUIT BREAKER STATE (from original fetcher)
// ============================================
interface CircuitBreakerState {
    failureCount: number;
    blockedUntil: number;
    lastError?: string;
    last403Preview?: string;
}

const circuitBreaker = new Map<string, CircuitBreakerState>();
const BLOCKED_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FAILURES_BEFORE_BLOCK = 3;

// ============================================
// LAST FETCH INFO (from original fetcher)
// ============================================
export let lastFetchInfo = {
    timestamp: new Date().toISOString(),
    totalFetched: 0,
    totalKept: 0,
    sourcesProcessed: 0,
    lastArticle: null as NormalizedItem | null,
    recentArticles: [] as NormalizedItem[]
};

export function getLastFetchInfo() {
    return lastFetchInfo;
}

// ============================================
// BLOCKED FEEDS TRACKING
// ============================================
export function getBlockedFeeds(): { url: string; reason: string; blockedUntil: string; preview?: string }[] {
    const blocked: { url: string; reason: string; blockedUntil: string; preview?: string }[] = [];
    const now = Date.now();
    circuitBreaker.forEach((state, url) => {
          if (state.blockedUntil > now) {
                  blocked.push({
                            url,
                            reason: state.lastError || 'Unknown',
                            blockedUntil: new Date(state.blockedUntil).toISOString(),
                            preview: state.last403Preview
                  });
          }
    });
    return blocked;
}

// ============================================
// INTEGRATED FETCH - USES PIPELINE
// ============================================
/**
 * Main entry point - fetches all RSS feeds using the unified pipeline
 * 
 * This function:
 * 1. Filters enabled feeds
 * 2. Passes them through the 5-stage pipeline
 * 3. Applies circuit breaker logic
 * 4. Stores results in itemStore
 * 5. Updates lastFetchInfo
 */
export async function fetchAllRSSArticles(): Promise<FetchResult[]> {
    const startTime = Date.now();

  // Process all enabled feeds through the unified pipeline
  const pipelineResults = await processFeedsFullPipeline(
        RSS_FEEDS.filter(f => f.enabled !== false)
      );

  // Convert pipeline results to FetchResult format for backward compatibility
  const results: FetchResult[] = [];

  for (const pipelineResult of pipelineResults) {
        const feedName = pipelineResult.feed.name;
        const articles = pipelineResult.articles || [];

      // Store articles in itemStore
      for (const article of articles) {
              itemStore.set(article.id, article);

          // Update circuit breaker on success
          const cb = circuitBreaker.get(pipelineResult.feed.url);
              if (cb) {
                        cb.failureCount = 0;
                        cb.blockedUntil = 0;
              }

          // Update feed stats
          feedStats.set(pipelineResult.feed.url, {
                    lastFetch: new Date().toISOString(),
                    lastSuccess: new Date().toISOString(),
                    lastError: null,
                    itemsFetched: articles.length
          });
      }

      // Handle errors
      if (pipelineResult.error) {
              const cb = circuitBreaker.get(pipelineResult.feed.url) || {
                        failureCount: 0,
                        blockedUntil: 0
              };
              cb.failureCount++;
              cb.lastError = pipelineResult.error.message;

          if (cb.failureCount >= MAX_FAILURES_BEFORE_BLOCK) {
                    cb.blockedUntil = Date.now() + BLOCKED_COOLDOWN_MS;
                    console.log(`🚫 [${feedName}] Blocked for 24 hours after ${cb.failureCount} failures`);
          }
              circuitBreaker.set(pipelineResult.feed.url, cb);

          feedStats.set(pipelineResult.feed.url, {
                    lastFetch: new Date().toISOString(),
                    lastSuccess: null,
                    lastError: pipelineResult.error.message,
                    itemsFetched: 0
          });
      }

      // Convert to FetchResult format
      const result: FetchResult = {
              status: pipelineResult.error ? 'error' : 'ok',
              articles: articles,
              meta: {
                        feed: feedName,
                        fetchedRaw: pipelineResult.rawCount || 0,
                        kept: articles.length,
                        filteredOut: (pipelineResult.rawCount || 0) - articles.length,
                        durationMs: Date.now() - startTime
              }
      };

      if (pipelineResult.error) {
              result.error = pipelineResult.error;
      }

      results.push(result);
  }

  // Add manual articles if present
  if (manualArticles.length) {
        results.unshift({
                status: 'ok',
                articles: manualArticles,
                meta: {
                          feed: 'Manual Articles',
                          fetchedRaw: manualArticles.length,
                          kept: manualArticles.length,
                          filteredOut: 0,
                          durationMs: 0
                }
        });
  }

  // Archive old articles
  archiveOldArticles();

  // Update lastFetchInfo
  const totalFetched = results.reduce((sum, r) => sum + r.meta.fetchedRaw, 0);
    const totalKept = results.reduce((sum, r) => sum + r.meta.kept, 0);
    const sourcesProcessed = results.length;

  const allItems = Array.from(itemStore.values());
    const sortedItems = allItems.sort((a, b) => 
                                          new Date(b.fetchedAt || b.pubDate || 0).getTime() - 
                                          new Date(a.fetchedAt || a.pubDate || 0).getTime()
                                        );

  lastFetchInfo = {
        timestamp: new Date().toISOString(),
        totalFetched,
        totalKept,
        sourcesProcessed,
        lastArticle: sortedItems[0] || null,
        recentArticles: sortedItems.slice(0, 5)
  };

  console.log(`✅ Pipeline fetch completed: ${totalFetched} fetched, ${totalKept} kept from ${sourcesProcessed} sources`);

  return results;
}

/**
 * MIGRATION GUIDE
 * ===============
 * 
 * To enable this integration layer:
 * 
 * 1. In your main entry point (e.g., server.ts), change:
 *    FROM: import { fetchAllRSSArticles } from './feeds/fetcher.js'
 *    TO:   import { fetchAllRSSArticles } from './feeds/fetcher-integration.js'
 * 
 * 2. All existing code remains the same:
 *    const results = await fetchAllRSSArticles();
 *    const blockedFeeds = getBlockedFeeds();
 *    const info = getLastFetchInfo();
 * 
 * 3. The pipeline provides additional benefits:
 *    - Cross-feed deduplication (Stage 3)
 *    - Batch classification (Stage 4)
 *    - Standardized error handling
 *    - Better logging and metrics
 * 
 * 4. When ready, old fetcher.ts can be kept as reference or archived
 */
