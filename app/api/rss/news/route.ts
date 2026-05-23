import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/with-auth';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

// Free RSS feeds for forex/financial news
const RSS_FEEDS = [
  {
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    category: 'business',
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/?format=rss',
    category: 'business',
  },
  {
    name: 'Bloomberg Markets',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'business',
  },
  {
    name: 'ForexFactory News',
    url: 'https://www.forexfactory.com/news.php?format=rss',
    category: 'forex',
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/',
    category: 'business',
  },
  {
    name: 'CNBC Markets',
    url: 'https://feeds.nbcnews.com/nbcnews/public/world',
    category: 'business',
  },
  {
    name: 'WSJ Markets',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    category: 'business',
  },
];

/**
 * Proxy RSS feeds for news
 * Server-side fetch bypasses CORS restrictions
 */
export async function GET(request: NextRequest) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get('keywords');
    const currency = searchParams.get('currency');

    console.log(`[API] Fetching RSS news feeds (keywords: ${keywords}, currency: ${currency})...`);

    // Fetch all RSS feeds in parallel (server-side, no CORS)
    const feedPromises = RSS_FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TradeIntelAI/1.0)',
          },
          next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!response.ok) {
          console.warn(`[API] RSS feed ${feed.name} failed: ${response.status}`);
          return { name: feed.name, success: false, error: response.status };
        }

        const xmlText = await response.text();
        console.log(`[API] RSS feed ${feed.name} fetched: ${xmlText.length} bytes`);
        return { name: feed.name, success: true, xml: xmlText, category: feed.category };
      } catch (error: any) {
        console.error(`[API] RSS feed ${feed.name} error:`, error.message);
        return { name: feed.name, success: false, error: error.message };
      }
    });

    const feedResults = await Promise.all(feedPromises);
    const successCount = feedResults.filter(f => f.success).length;
    console.log(`[API] RSS news feeds: ${successCount}/${RSS_FEEDS.length} successful`);

    return NextResponse.json({
      success: true,
      feeds: feedResults,
      keywords,
      currency,
    });
  } catch (error: any) {
    console.error('[API] RSS news fetch failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch news RSS feeds',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

