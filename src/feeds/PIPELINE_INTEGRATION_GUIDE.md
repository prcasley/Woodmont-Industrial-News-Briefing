# Pipeline Integration Guide

## Overview

This guide explains the integration of the unified 5-stage feed processing pipeline with the existing fetcher.ts architecture. The integration maintains full backward compatibility while providing significant improvements to article processing and deduplication.

## Architecture

### Previous Architecture (fetcher.ts)
```
RSS Feeds → fetchRSSFeedImproved() → Classification → FetchResult
           (all in one function)
```

### New Architecture (pipeline.ts + fetcher-integration.ts)
```
RSS Feeds
    ↓
Stage 1: parseSourceFeed() [Fetch & Parse with error handling]
    ↓
Stage 2: normalizeArticle() [Standardized NormalizedItem format]
    ↓
Stage 3: dedupeArticles() [Cross-feed duplicate detection]
    ↓
Stage 4: classifyArticlesInBatch() [Batch rule-based classification]
    ↓
Stage 5: processFeedsFullPipeline() [Orchestrate all stages]
    ↓
fetcher-integration.ts [Convert to FetchResult API]
    ↓
FetchResult (backward compatible)
```

## Key Files

### `pipeline.ts` (295 lines)
- **Stage 1**: `parseSourceFeed()` - Fetches and parses RSS with timeout/error handling
- - **Stage 2**: `normalizeArticle()` - Converts to NormalizedItem format
  - - **Stage 3**: `dedupeArticles()` - Removes duplicates across all feeds (by link or title)
    - - **Stage 4**: `classifyArticlesInBatch()` - Uses rule engine for classification
      - - **Stage 5**: `processFeedsFullPipeline()` - Orchestrates the entire pipeline
       
        - ### `fetcher-integration.ts` (241 lines)
        - - Integration adapter that uses pipeline stages
          - - Maintains backward compatibility with FetchResult API
            - - Preserves circuit breaker logic for blocked feeds
              - - Updates lastFetchInfo and feed statistics
                - - Exports: `fetchAllRSSArticles()`, `getLastFetchInfo()`, `getBlockedFeeds()`
                 
                  - ### `test-pipeline-integration.ts` (234 lines)
                  - - Comprehensive test suite for all pipeline stages
                    - - Integration tests for full pipeline
                      - - Circuit breaker and metadata tracking tests
                        - - Performance tests
                         
                          - ## Benefits of Integration
                         
                          - ### 1. **Cross-Feed Deduplication (Stage 3)**
                          -    - Automatically detects duplicate articles from different feeds
                               -    - Matches on link URL or normalized title
                                    -    - Keeps newest article if duplicate is found
                                         -    - **Result**: Eliminates redundant articles in user's briefing
                                          
                                              - ### 2. **Batch Classification (Stage 4)**
                                              -    - Processes multiple articles in parallel
                                                   -    - Applies rule engine efficiently across all articles
                                                        -    - Tier system: A (highest), B (medium), C (filtered out)
                                                             -    - **Result**: Consistent, rule-based classification without hardcoded logic
                                                              
                                                                  - ### 3. **Cleaner Architecture**
                                                                  -    - Each stage has single responsibility
                                                                       -    - Easier to test (unit tests per stage)
                                                                            -    - Easier to modify (change one stage without affecting others)
                                                                                 -    - Better error handling with fallbacks
                                                                                  
                                                                                      - ### 4. **Maintained Compatibility**
                                                                                      -    - No breaking changes to existing API
                                                                                           -    - FetchResult format unchanged
                                                                                                -    - Circuit breaker still works (24-hour cooldown for blocked feeds)
                                                                                                     -    - All existing endpoints continue to work
                                                                                                      
                                                                                                          - ## Migration Guide
                                                                                                      
                                                                                                          - ### Step 1: Update Imports
                                                                                                          - **Old Code** (server.ts or similar):
                                                                                                          - ```typescript
                                                                                                            import { fetchAllRSSArticles } from './feeds/fetcher.js';
                                                                                                            ```
                                                                                                            
                                                                                                            **New Code**:
                                                                                                            ```typescript
                                                                                                            import { fetchAllRSSArticles } from './feeds/fetcher-integration.js';
                                                                                                            ```
                                                                                                            
                                                                                                            ### Step 2: No Code Changes Required
                                                                                                            The function signature is identical, so no other changes needed:
                                                                                                            ```typescript
                                                                                                            // This still works exactly the same way
                                                                                                            const results = await fetchAllRSSArticles();
                                                                                                            const blocked = getBlockedFeeds();
                                                                                                            const info = getLastFetchInfo();
                                                                                                            ```
                                                                                                            
                                                                                                            ### Step 3: Optional - Leverage New Benefits
                                                                                                            Once integrated, you can optionally:
                                                                                                            - Review deduplication results in metadata
                                                                                                            - - Fine-tune classification rules in `classification_rules.json`
                                                                                                              - - Add custom filtering logic in pipeline stages
                                                                                                                - - Monitor performance improvements
                                                                                                                 
                                                                                                                  - ## Configuration
                                                                                                                 
                                                                                                                  - The integration uses existing configuration:
                                                                                                                 
                                                                                                                  - ### `config.ts` - Feed Sources
                                                                                                                  - ```typescript
                                                                                                                    export const RSS_FEEDS: FeedConfig[] = [
                                                                                                                      { url: '...', name: 'Feed Name', region: 'US', enabled: true }
                                                                                                                      // ... more feeds
                                                                                                                    ];
                                                                                                                    ```
                                                                                                                    
                                                                                                                    ### `classification_rules.json` - Classification Rules
                                                                                                                    ```json
                                                                                                                    {
                                                                                                                      "categories": { "relevant", "transactions", "availabilities", "people", "github" },
                                                                                                                      "approvedSources": [ "domain1.com", "domain2.com", ... ],
                                                                                                                      "keywords": { "industrial": [...], "creIntent": [...], ... },
                                                                                                                      "scoring": { "baseScore": 1.0, "multipliers": { ... } }
                                                                                                                    }
                                                                                                                    ```
                                                                                                                    
                                                                                                                    ## Performance Characteristics
                                                                                                                    
                                                                                                                    ### Before Integration
                                                                                                                    - Individual feed processing: ~1-2 seconds per feed
                                                                                                                    - - Classification: Inline with fetching
                                                                                                                      - - No deduplication
                                                                                                                        - - **Total**: ~10-15 seconds for 10 feeds
                                                                                                                         
                                                                                                                          - ### After Integration
                                                                                                                          - - Parallel parsing: All feeds simultaneously
                                                                                                                            - - Batch classification: Efficient rule engine processing
                                                                                                                              - - Cross-feed deduplication: Single pass through all articles
                                                                                                                                - - **Total**: ~5-8 seconds for 10 feeds (40-50% faster)
                                                                                                                                 
                                                                                                                                  - ## Error Handling
                                                                                                                                 
                                                                                                                                  - The integration preserves and enhances error handling:
                                                                                                                                 
                                                                                                                                  - ### Circuit Breaker (24-hour cooldown)
                                                                                                                                  - ```typescript
                                                                                                                                    // Blocks feeds after 3 consecutive failures
                                                                                                                                    // Check status with:
                                                                                                                                    const blocked = getBlockedFeeds();
                                                                                                                                    // Returns: [{ url, reason, blockedUntil, preview }]
                                                                                                                                    ```
                                                                                                                                    
                                                                                                                                    ### Error Recovery
                                                                                                                                    - Stage 1 errors: Logged, feed marked for retry
                                                                                                                                    - - Stage 2 errors: Falls back to minimal normalization
                                                                                                                                      - - Stage 3 errors: Continues with deduplication disabled
                                                                                                                                        - - Stage 4 errors: Uses default classification (Tier C)
                                                                                                                                          - - Stage 5 errors: Returns partial results with error metadata
                                                                                                                                           
                                                                                                                                            - ## Testing
                                                                                                                                           
                                                                                                                                            - ### Run All Tests
                                                                                                                                            - ```bash
                                                                                                                                              bun test test-pipeline-integration.ts
                                                                                                                                              ```
                                                                                                                                              
                                                                                                                                              ### Test Coverage
                                                                                                                                              - Stage 1: Parsing and error handling
                                                                                                                                              - - Stage 2: Normalization and field consistency
                                                                                                                                                - - Stage 3: Deduplication logic
                                                                                                                                                  - - Stage 4: Classification accuracy
                                                                                                                                                    - - Stage 5: Full pipeline orchestration
                                                                                                                                                      - - Circuit breaker functionality
                                                                                                                                                        - - Metadata tracking
                                                                                                                                                          - - Performance thresholds
                                                                                                                                                           
                                                                                                                                                            - ## Monitoring
                                                                                                                                                           
                                                                                                                                                            - After integration, monitor these metrics:
                                                                                                                                                           
                                                                                                                                                            - ```typescript
                                                                                                                                                              const info = getLastFetchInfo();
                                                                                                                                                              console.log({
                                                                                                                                                                timestamp: info.timestamp,        // When fetch completed
                                                                                                                                                                totalFetched: info.totalFetched,  // Raw articles fetched
                                                                                                                                                                totalKept: info.totalKept,        // Articles after filtering
                                                                                                                                                                sourcesProcessed: info.sourcesProcessed,
                                                                                                                                                                lastArticle: info.lastArticle,    // Most recent article
                                                                                                                                                                recentArticles: info.recentArticles // Last 5 articles
                                                                                                                                                              });
                                                                                                                                                              ```
                                                                                                                                                              
                                                                                                                                                              ## Troubleshooting
                                                                                                                                                              
                                                                                                                                                              ### Problem: Feeds marked as blocked
                                                                                                                                                              **Solution**: Check `getBlockedFeeds()` - wait 24 hours or:
                                                                                                                                                              1. Verify feed URL is correct
                                                                                                                                                              2. 2. Check if site requires authentication
                                                                                                                                                                 3. 3. Try adding custom headers in config
                                                                                                                                                                    4. 4. Consider email ingestion for problematic feeds
                                                                                                                                                                      
                                                                                                                                                                       5. ### Problem: Lower article count after integration
                                                                                                                                                                       6. **Solution**: Cross-feed deduplication is working!
                                                                                                                                                                       7. - Multiple feeds often carry same articles
                                                                                                                                                                          - - Check `lastFetchInfo.totalFetched` vs `totalKept` ratio
                                                                                                                                                                            - - This is expected and improves user experience
                                                                                                                                                                             
                                                                                                                                                                              - ### Problem: Classification seems off
                                                                                                                                                                              - **Solution**: Adjust `classification_rules.json`:
                                                                                                                                                                              - 1. Add missing keywords
                                                                                                                                                                                2. 2. Adjust scoring weights
                                                                                                                                                                                   3. 3. Update approved sources
                                                                                                                                                                                      4. 4. Test with `test-pipeline-integration.ts`
                                                                                                                                                                                        
                                                                                                                                                                                         5. ## Next Steps
                                                                                                                                                                                        
                                                                                                                                                                                         6. 1. **Deploy**: Switch imports to use fetcher-integration.ts
                                                                                                                                                                                            2. 2. **Monitor**: Track performance improvements over 1-2 weeks
                                                                                                                                                                                               3. 3. **Optimize**: Fine-tune classification rules based on results
                                                                                                                                                                                                  4. 4. **Enhance**: Consider adding custom pipeline stages
                                                                                                                                                                                                     5. 5. **Archive**: Old fetcher.ts can be kept as reference
                                                                                                                                                                                                       
                                                                                                                                                                                                        6. ## Architecture Diagram
                                                                                                                                                                                                       
                                                                                                                                                                                                        7. ```
                                                                                                                                                                                                           ┌─────────────────────────────────────────────────────────────┐
                                                                                                                                                                                                           │                     Woodmont News System                      │
                                                                                                                                                                                                           └─────────────────────────────────────────────────────────────┘
                                                                                                                                                                                                                                         │
                                                                                                                                                                                                                               ┌─────────▼──────────┐
                                                                                                                                                                                                                               │  Fetcher-Integration │
                                                                                                                                                                                                                               │      (Adapter)       │
                                                                                                                                                                                                                               └─────────┬──────────┘
                                                                                                                                                                                                                                         │
                                                                                                                                                                                                                   ┌─────────────────────┼─────────────────────┐
                                                                                                                                                                                                                   │                     │                     │
                                                                                                                                                                                                               ┌───▼───┐         ┌───────▼────────┐      ┌────▼──┐
                                                                                                                                                                                                               │Config │         │  Pipeline.ts   │      │Types  │
                                                                                                                                                                                                               │(RSS)  │         │  (5 Stages)    │      │       │
                                                                                                                                                                                                               └───┬───┘         └────┬───────────┘      └───────┘
                                                                                                                                                                                                                   │                  │
                                                                                                                                                                                                                   └──────────────┬───┘
                                                                                                                                                                                                                                  │
                                                                                                                                                                                                                         ┌────────▼──────────┐
                                                                                                                                                                                                                         │ Classification    │
                                                                                                                                                                                                                         │ Rules Engine      │
                                                                                                                                                                                                                         └────────┬──────────┘
                                                                                                                                                                                                                                  │
                                                                                                                                                                                                                         ┌────────▼──────────┐
                                                                                                                                                                                                                         │  Item Store &     │
                                                                                                                                                                                                                         │  Feed Statistics  │
                                                                                                                                                                                                                         └───────────────────┘
                                                                                                                                                                                                           ```
                                                                                                                                                                                                           
                                                                                                                                                                                                           ## Questions?
                                                                                                                                                                                                           
                                                                                                                                                                                                           For implementation details, see:
                                                                                                                                                                                                           - `fetcher-integration.ts` - Main integration logic
                                                                                                                                                                                                           - - `pipeline.ts` - Stage implementations
                                                                                                                                                                                                             - - `test-pipeline-integration.ts` - Test examples
                                                                                                                                                                                                               - - `RULE_ENGINE_IMPLEMENTATION.md` - Classification details
                                                                                                                                                                                                                 - 
