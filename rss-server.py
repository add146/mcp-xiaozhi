"""
RSS MCP Server - Provides RSS tools for Xiaozhi
Tools: rss_latest_news, rss_feed_list, rss_by_category
"""
import json
import os
from fastmcp import FastMCP
import feedparser
from typing import Optional

# Initialize FastMCP server
mcp = FastMCP("RSS News Server")

# Config path
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "admin-backend", "config.json")

def load_feeds():
    """Load feeds from admin backend config"""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get('feeds', [])
    except Exception as e:
        print(f"Error loading feeds: {e}")
    
    # Default feeds if config not found
    return [
        {"id": "1", "title": "Hacker News", "url": "https://news.ycombinator.com/rss", "category": "Tech"},
        {"id": "2", "title": "TechCrunch", "url": "https://techcrunch.com/feed/", "category": "Tech"}
    ]


@mcp.tool()
def rss_latest_news(limit: int = 10) -> str:
    """
    Get latest news from all configured RSS feeds.
    
    Args:
        limit: Maximum number of articles to return (default 10, max 30)
    
    Returns:
        Latest news articles from all feeds
    """
    limit = min(max(limit, 1), 30)
    feeds = load_feeds()
    all_articles = []
    
    for feed_config in feeds:
        try:
            feed = feedparser.parse(feed_config['url'])
            for entry in feed.entries[:5]:  # Max 5 per feed
                all_articles.append({
                    'title': entry.get('title', 'No title'),
                    'link': entry.get('link', ''),
                    'source': feed_config['title'],
                    'published': entry.get('published', 'Unknown date')
                })
        except Exception as e:
            continue
    
    # Sort by date and limit
    articles = all_articles[:limit]
    
    if not articles:
        return "No articles found. Please add RSS feeds via the admin panel."
    
    result = f"📰 Latest {len(articles)} News:\n\n"
    for i, article in enumerate(articles, 1):
        result += f"{i}. **{article['title']}**\n"
        result += f"   Source: {article['source']}\n"
        result += f"   Link: {article['link']}\n\n"
    
    return result


@mcp.tool()
def rss_feed_list() -> str:
    """
    List all configured RSS feeds.
    
    Returns:
        List of all RSS feeds with their categories
    """
    feeds = load_feeds()
    
    if not feeds:
        return "No RSS feeds configured. Please add feeds via the admin panel at http://localhost:3000"
    
    result = "📋 Configured RSS Feeds:\n\n"
    
    # Group by category
    categories = {}
    for feed in feeds:
        cat = feed.get('category', 'Uncategorized')
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(feed)
    
    for category, cat_feeds in categories.items():
        result += f"**{category}:**\n"
        for feed in cat_feeds:
            result += f"  • {feed['title']} ({feed['url']})\n"
        result += "\n"
    
    return result


@mcp.tool()
def rss_by_category(category: str, limit: int = 10) -> str:
    """
    Get news from a specific category.
    
    Args:
        category: Category name (e.g., 'Tech', 'News', 'Business')
        limit: Maximum number of articles (default 10)
    
    Returns:
        News articles from feeds in the specified category
    """
    limit = min(max(limit, 1), 20)
    feeds = load_feeds()
    
    # Filter feeds by category
    matching_feeds = [f for f in feeds if category.lower() in f.get('category', '').lower()]
    
    if not matching_feeds:
        return f"No feeds found in category '{category}'. Available categories: " + \
               ", ".join(set(f.get('category', 'Uncategorized') for f in feeds))
    
    articles = []
    for feed_config in matching_feeds:
        try:
            feed = feedparser.parse(feed_config['url'])
            for entry in feed.entries[:limit]:
                articles.append({
                    'title': entry.get('title', 'No title'),
                    'link': entry.get('link', ''),
                    'source': feed_config['title']
                })
        except:
            continue
    
    articles = articles[:limit]
    
    if not articles:
        return f"No articles found in category '{category}'"
    
    result = f"📰 {category} News ({len(articles)} articles):\n\n"
    for i, article in enumerate(articles, 1):
        result += f"{i}. **{article['title']}**\n"
        result += f"   Source: {article['source']} | {article['link']}\n\n"
    
    return result


if __name__ == "__main__":
    mcp.run(transport="stdio")
