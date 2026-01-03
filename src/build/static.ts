/**
 * Static RSS build module for GitHub Pages
 * Generates RSS/JSON feeds and static HTML for deployment
 */

import * as fs from 'fs';
import * as path from 'path';
import { log } from '../server/logging.js';
import { fetchAllRSSArticles, isAllowedLink, shouldRejectUrl, isFromMandatorySource } from '../feeds/fetcher.js';
import { NormalizedItem } from '../types/index.js';

// Directory for static output
const DOCS_DIR = path.join(process.cwd(), 'docs');

/**
 * Build static RSS/JSON feeds for GitHub Pages deployment
 */
export async function buildStaticRSS(): Promise<void> {
    const startTime = Date.now();
    log('info', 'Starting RSS feed generation');

    try {
        // === STEP 1: Load existing articles from GitHub Pages feed ===
        let existingArticles: NormalizedItem[] = [];
        const feedJsonPath = path.join(DOCS_DIR, 'feed.json');

        if (fs.existsSync(feedJsonPath)) {
            try {
                const feedData = JSON.parse(fs.readFileSync(feedJsonPath, 'utf-8'));
                existingArticles = feedData.items || [];
                log('info', `Loaded ${existingArticles.length} existing articles from feed.json`);
            } catch (e) {
                log('warn', 'Could not parse existing feed.json, starting fresh');
            }
        }

        // Create set of existing GUIDs for deduplication
        const existingGuids = new Set(existingArticles.map(a => a.id));
        log('info', `Loaded ${existingGuids.size} existing GUIDs for deduplication`);

        // === STEP 2: Fetch fresh articles ===
        log('info', 'Fetching RSS feeds from sources');
        const results = await fetchAllRSSArticles();

        const fetchStats = {
            totalSources: results.length,
            successful: results.filter(r => r.status === 'ok').length,
            failed: results.filter(r => r.status === 'error').length,
            totalArticlesFetched: results.reduce((sum, r) => sum + r.meta.fetchedRaw, 0)
        };
        log('info', 'RSS fetch completed', fetchStats);

        // Get ALL freshly fetched items directly from results
        const allItems: NormalizedItem[] = [];
        for (const result of results) {
            if (result.status === 'ok' && result.articles) {
                allItems.push(...result.articles);
            }
        }
        log('info', `Got ${allItems.length} items from fetch results`);

        // Apply light filtering - just check URL validity
        const filteredNewItems = allItems.filter(item => {
            if (!item.link || !item.title) return false;
            if (shouldRejectUrl(item.link)) return false;
            return isAllowedLink(item.link);
        });
        log('info', `Filtered to ${filteredNewItems.length} articles after domain checks`, {
            beforeFiltering: allItems.length,
            fromMandatorySources: filteredNewItems.filter(i => isFromMandatorySource(i)).length
        });

        // Deduplication - only keep truly new items
        const newItems = filteredNewItems.filter(item => !existingGuids.has(item.id));
        log('info', `Found ${newItems.length} NEW articles`, {
            beforeDedupe: filteredNewItems.length,
            duplicatesRemoved: filteredNewItems.length - newItems.length
        });

        // === STEP 3: Merge new + existing articles ===
        const mergedArticles = [...newItems, ...existingArticles];
        log('info', `Merged: ${newItems.length} new + ${existingArticles.length} existing = ${mergedArticles.length} total`);

        // === STEP 4: Apply 30-day cleanup ===
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const cleanedArticles = mergedArticles.filter(item => {
            const pubDate = new Date(item.pubDate || item.fetchedAt || Date.now());
            return pubDate >= thirtyDaysAgo;
        });

        const removedCount = mergedArticles.length - cleanedArticles.length;
        if (removedCount > 0) {
            log('info', `Auto-deleted ${removedCount} articles older than 30 days`);
        }

        // Sort by publication date (newest first)
        const sortedItems = cleanedArticles.sort((a, b) =>
            new Date(b.pubDate || b.fetchedAt || 0).getTime() -
            new Date(a.pubDate || a.fetchedAt || 0).getTime()
        );

        // Take top 150 for RSS feed
        const rssItems = sortedItems.slice(0, 150);
        log('info', `Final feed: ${rssItems.length} articles (capped at 150)`);

        // Ensure docs directory exists
        if (!fs.existsSync(DOCS_DIR)) {
            fs.mkdirSync(DOCS_DIR, { recursive: true });
        }

        // Generate and write RSS XML
        const rssXML = generateRSSXML(rssItems);
        fs.writeFileSync(path.join(DOCS_DIR, 'rss.xml'), rssXML, 'utf8');
        log('info', 'Generated docs/rss.xml', { itemCount: rssItems.length });

        // Generate and write JSON feed
        const feedJSON = generateJSONFeed(rssItems);
        fs.writeFileSync(path.join(DOCS_DIR, 'feed.json'), JSON.stringify(feedJSON, null, 2), 'utf8');
        log('info', 'Generated docs/feed.json', { itemCount: rssItems.length });

        const duration = Date.now() - startTime;
        log('info', 'Static build completed successfully', {
            durationMs: duration,
            totalArticles: rssItems.length,
            sourcesProcessed: fetchStats.totalSources
        });

    } catch (error) {
        log('error', 'Static build failed', {
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

/**
 * Generate RSS 2.0 XML from articles
 */
function generateRSSXML(items: NormalizedItem[]): string {
    const categoryLabels: Record<string, string> = {
        relevant: 'RELEVANT ARTICLES — Macro Trends & Industrial Real Estate News',
        transaction: 'TRANSACTIONS — Notable Sales/Leases (≥100K SF or ≥$25M)',
        availabilities: 'AVAILABILITIES — New Industrial Properties for Sale/Lease',
        people: 'PEOPLE NEWS — Personnel Moves in Industrial Brokerage/Development'
    };

    const rssItemsXML = items.map(item => {
        const category = item.category || 'relevant';
        const categoryLabel = categoryLabels[category] || categoryLabels.relevant;

        let authorString = '';
        if (item.author) {
            authorString = typeof item.author === 'string' ? item.author : String(item.author);
        }

        const imageUrl = item.image || item.imageUrl || item.thumbnailUrl || '';

        return `\n    <item>
      <title><![CDATA[${item.title || 'Untitled'}]]></title>
      <link>${item.link || '#'}</link>
      <guid isPermaLink="true">${item.link || item.id || '#'}</guid>
      <pubDate>${item.pubDate ? new Date(item.pubDate).toUTCString() : new Date().toUTCString()}</pubDate>
      <description><![CDATA[${item.description || ''}]]></description>
      <category><![CDATA[${categoryLabel}]]></category>
      <source><![CDATA[${item.source || 'Unknown'}]]></source>
      ${authorString ? `<author><![CDATA[${authorString}]]></author>` : ''}
      ${imageUrl ? `<enclosure url="${imageUrl.replace(/&/g, '&amp;')}" type="image/jpeg" />` : ''}
    </item>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Woodmont Industrial News Feed</title>
    <link>https://github.com/prcasley/Woodmont-Industrial-News-Briefing</link>
    <description>Daily industrial and CRE updates across key regions</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Woodmont RSS Aggregator</generator>
    <category>Industrial Real Estate</category>
    <category>Commercial Real Estate</category>${rssItemsXML}
  </channel>
</rss>`;
}

/**
 * Generate JSON Feed from articles
 */
function generateJSONFeed(items: NormalizedItem[]): object {
    const categoryLabels: Record<string, string> = {
        relevant: 'RELEVANT ARTICLES — Macro Trends & Industrial Real Estate News',
        transaction: 'TRANSACTIONS — Notable Sales/Leases (≥100K SF or ≥$25M)',
        availabilities: 'AVAILABILITIES — New Industrial Properties for Sale/Lease',
        people: 'PEOPLE NEWS — Personnel Moves in Industrial Brokerage/Development'
    };

    return {
        version: "https://jsonfeed.org/version/1.1",
        title: "Woodmont Industrial News Feed",
        home_page_url: "https://prcasley.github.io/Woodmont-Industrial-News-Briefing/",
        feed_url: "https://prcasley.github.io/Woodmont-Industrial-News-Briefing/feed.json",
        description: "Daily industrial and CRE updates across key regions",
        author: {
            name: "Woodmont Industrial Partners",
            url: "https://prcasley.github.io/Woodmont-Industrial-News-Briefing/"
        },
        items: items.map(item => {
            const category = item.category || 'relevant';
            const imageUrl = item.image || item.imageUrl || item.thumbnailUrl || null;

            let authorName = '';
            if (item.author) {
                authorName = typeof item.author === 'string' ? item.author : '';
            }
            if (!authorName) {
                authorName = item.source || 'Unknown';
            }

            const description = item.description || '';
            const summary = description ? (description.substring(0, 200) + (description.length > 200 ? '...' : '')) : '';

            return {
                id: item.id,
                url: item.link || '',
                title: item.title || 'Untitled',
                content_html: description,
                content_text: description,
                summary: summary,
                date_published: item.pubDate || new Date().toISOString(),
                date_modified: item.fetchedAt || new Date().toISOString(),
                image: imageUrl,
                author: { name: authorName },
                tags: [categoryLabels[category] || category, ...(item.regions || [])]
            };
        })
    };
}
