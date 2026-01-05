// Utility functions for the Woodmont Industrial News app

import { NEWSLETTER_LIMITS, CATEGORY_COLORS } from './config.js';

/**
 * Transforms article data from feed.json or API format
 * Fixes the source field bug - now correctly prioritizes source over author
 */
export function transformArticle(item) {
    // Extract author name properly
  let authorName = '';
    if (item.author) {
          authorName = typeof item.author === 'string' ? item.author : (item.author.name || '');
    }

  // Determine category from tags
  const firstTag = item.tags?.[0] || '';
    const tagLower = firstTag.toLowerCase();
    let category = 'relevant';
    if (tagLower.includes('transaction')) category = 'transaction';
    else if (tagLower.includes('availab')) category = 'availabilities';
    else if (tagLower.includes('people')) category = 'people';

  // FIX: Use actual source field first, fall back to author, then 'Unknown'
  return {
        ...item,
        link: item.url || item.link || '',
        pubDate: item.date_published || item.pubDate || new Date().toISOString(),
        description: item.content_text || item.content_html || item.description || '',
        source: item.source || item.publisher || authorName || 'Unknown',  // FIXED: source comes first
        author: authorName || undefined,  // Separate author field
        category: category,
        id: item.id || item.link || Math.random().toString()
  };
}

/**
 * Extract unique sources from articles
 */
export function getUniqueSources(articles) {
    const uniqueSources = new Set(
          articles
            .map(item => item.source || item.publisher)
            .filter(Boolean)
        );
    return Array.from(uniqueSources).sort();
}

/**
 * Filter articles based on criteria
 */
export function filterArticles(items, { timeframe, query, region, category, source, sort }) {
    let list = [...items];

  // Filter out articles with "not relevant", "excluded", and "blacklisted" categories
  list = list.filter(it => 
                         it.category !== 'not relevant' && 
                         it.category !== 'excluded' && 
                         it.category !== 'blacklisted'
                       );

  // Filter by timeframe
  if (timeframe) {
        const daysAgo = parseInt(timeframe, 10);
        const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        list = list.filter(it => {
                const pubDate = new Date(it.pubDate || it.fetchedAt || 0);
                return pubDate >= cutoffDate;
        });
  }

  // Filter by search query
  if (query) {
        const q = query.toLowerCase();
        list = list.filter(it =>
                (it.title && it.title.toLowerCase().includes(q)) ||
                (it.description && it.description.toLowerCase().includes(q))
                               );
  }

  // Filter by region
  if (region) {
        list = list.filter(it => {
                const r = region.toLowerCase();
                return (it.title + " " + it.description).toLowerCase().includes(r);
        });
  }

  // Filter by category
  if (category) {
        list = list.filter(it => it.category === category);
  }

  // Filter by source
  if (source) {
        list = list.filter(it => (it.source || it.publisher) === source);
  }

  // Sort articles
  if (sort === "newest") {
        list.sort((a, b) => new Date(b.pubDate || b.fetchedAt || 0) - new Date(a.pubDate || a.fetchedAt || 0));
  } else {
        list.sort((a, b) => new Date(a.pubDate || a.fetchedAt || 0) - new Date(b.pubDate || b.fetchedAt || 0));
  }

  return list;
}

/**
 * Build newsletter HTML (client-side for static mode)
 */
export function buildNewsletterHTML(articles, days) {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const dateRange = `${startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} (ET)`;

  const relevant = articles.filter(a => a.category === 'relevant').slice(0, NEWSLETTER_LIMITS.relevant);
    const transactions = articles.filter(a => a.category === 'transaction').slice(0, NEWSLETTER_LIMITS.transaction);
    const availabilities = articles.filter(a => a.category === 'availabilities').slice(0, NEWSLETTER_LIMITS.availabilities);
    const people = articles.filter(a => a.category === 'people').slice(0, NEWSLETTER_LIMITS.people);

  const renderArticle = (item) => {
        const region = item.regions?.[0] || 'US';
        const desc = (item.description || '').substring(0, 150) + '...';
        return `<div class="article-card">
              <div class="article-header">
                      <span class="badge badge-location">${region}</span>
                              <span class="badge badge-source">${item.source || 'Unknown'}</span>
                                    </div>
                                          <div class="article-content">${desc}</div>
                                                <div class="article-source">
                                                        <a href="${item.link}" class="source-link" target="_blank">📖 Read Full Article – ${item.source || 'Source'}</a>
                                                              </div>
                                                                  </div>`;
  };

  const renderSection = (title, icon, items) => {
        const content = items.length > 0 
          ? items.map(renderArticle).join('') 
                : '<div class="empty-section">No articles available for this section.</div>';
        return `<div class="section">
              <div class="section-header">
                      <div class="section-icon">${icon}</div>
                              <div class="section-title">${title}</div>
                                    </div>
                                          ${content}
                                              </div>`;
  };

  return `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}
              .container{max-width:800px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
                  .header{background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;padding:40px 30px;text-align:center}
                      .header h1{font-size:28px;margin-bottom:10px}
                          .header .subtitle{font-size:16px;opacity:.9;margin-bottom:8px}
                              .header .date-range{font-size:14px;opacity:.8;font-style:italic}
                                  .content{padding:30px}
                                      .section{margin-bottom:35px}
                                          .section-header{display:flex;align-items:center;margin-bottom:20px;padding-bottom:10px;border-bottom:3px solid #667eea}
                                              .section-icon{width:40px;height:40px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-right:15px;font-size:20px}
                                                  .section-title{font-size:20px;color:#1e3c72;font-weight:600}
                                                      .article-card{background:#f8f9fa;border-left:4px solid #667eea;padding:20px;margin-bottom:15px;border-radius:8px}
                                                          .article-header{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
                                                              .badge{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase}
                                                                  .badge-location{background:#e3f2fd;color:#1976d2}
                                                                      .badge-source{background:#e8f5e9;color:#388e3c}
                                                                          .article-content{color:#333;line-height:1.6;margin-bottom:10px}
                                                                              .article-source{margin-top:12px;padding-top:12px;border-top:1px solid #dee2e6}
                                                                                  .source-link{color:#667eea;text-decoration:none;font-weight:500;font-size:14px}
                                                                                      .empty-section{background:#f8f9fa;padding:20px;border-radius:8px;text-align:center;color:#666;font-style:italic}
                                                                                          .footer{background:#f8f9fa;padding:25px 30px;text-align:center;color:#666;font-size:14px;border-top:1px solid #dee2e6}
                                                                                            </style></head><body><div class="container">
                                                                                                <div class="header">
                                                                                                      <h1>🏭 Woodmont Industrial Partners</h1>
                                                                                                            <div class="subtitle">Daily Industrial News Briefing</div>
                                                                                                                  <div class="date-range">Coverage Period: ${dateRange}</div>
                                                                                                                        <div class="date-range">Focus Markets: NJ, PA, FL, TX</div>
                                                                                                                            </div>
                                                                                                                                <div class="content">
                                                                                                                                      ${renderSection('RELEVANT ARTICLES — Macro Trends & Industrial Real Estate News', '📰', relevant)}
                                                                                                                                            ${renderSection('TRANSACTIONS — Notable Sales/Leases (≥100K SF or ≥$25M)', '💼', transactions)}
                                                                                                                                                  ${renderSection('AVAILABILITIES — New Industrial Properties for Sale/Lease', '🏢', availabilities)}
                                                                                                                                                        ${renderSection('PEOPLE NEWS — Personnel Moves in Industrial Brokerage/Development', '👥', people)}
                                                                                                                                                            </div>
                                                                                                                                                                <div class="footer">
                                                                                                                                                                      <strong>Woodmont Industrial Partners</strong><br>
                                                                                                                                                                            Daily Industrial News Briefing – Confidential & Proprietary<br>
                                                                                                                                                                                  © 2025 All Rights Reserved
                                                                                                                                                                                      </div>
                                                                                                                                                                                        </div></body></html>`;
}

/**
 * Get category color classes
 */
export function getCategoryColors(category) {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['relevant'];
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString();
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
}

export default {
    transformArticle,
    getUniqueSources,
    filterArticles,
    buildNewsletterHTML,
    getCategoryColors,
    formatDate,
    formatDateTime
};
