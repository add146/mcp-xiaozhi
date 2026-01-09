"""
RSS MCP Server - Provides RSS tools for Xiaozhi
Each configured feed appears as a separate tool in Enabled Services
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


def fetch_feed_articles(url: str, limit: int = 10) -> list:
    """Fetch articles from a single feed"""
    try:
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:limit]:
            articles.append({
                'title': entry.get('title', 'No title'),
                'link': entry.get('link', ''),
                'published': entry.get('published', 'Unknown date')
            })
        return articles
    except Exception as e:
        return []


# Create a tool for each feed dynamically
feeds = load_feeds()

for feed_config in feeds:
    feed_title = feed_config['title']
    feed_url = feed_config['url']
    feed_category = feed_config.get('category', 'News')
    
    # Create safe function name from title
    safe_name = feed_title.lower().replace(' ', '_').replace('-', '_')
    safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '_')
    tool_name = f"feed_{safe_name}"
    
    # Create the tool function
    def create_feed_tool(title, url, category):
        def feed_tool(limit: int = 10) -> str:
            f"""
            Get latest news from {title}.
            Category: {category}
            
            Args:
                limit: Maximum number of articles (default 10, max 20)
            
            Returns:
                Latest articles from {title}
            """
            limit = min(max(limit, 1), 20)
            articles = fetch_feed_articles(url, limit)
            
            if not articles:
                return f"Could not fetch articles from {title}"
            
            result = f"📰 {title} ({len(articles)} articles):\n\n"
            for i, article in enumerate(articles, 1):
                result += f"{i}. **{article['title']}**\n"
                result += f"   {article['link']}\n\n"
            
            return result
        
        feed_tool.__name__ = f"feed_{title.lower().replace(' ', '_')}"
        feed_tool.__doc__ = f"Get latest news from {title}. Category: {category}"
        return feed_tool
    
    # Register the tool
    tool_func = create_feed_tool(feed_title, feed_url, feed_category)
    mcp.tool(name=tool_name, description=f"Get news from {feed_title} ({feed_category})")(tool_func)


@mcp.tool()
def rss_all_feeds(limit: int = 5) -> str:
    """
    Get latest news from ALL configured RSS feeds.
    
    Args:
        limit: Number of articles per feed (default 5)
    
    Returns:
        Latest articles from all feeds
    """
    feeds = load_feeds()
    all_articles = []
    
    for feed_config in feeds:
        articles = fetch_feed_articles(feed_config['url'], limit)
        for article in articles:
            article['source'] = feed_config['title']
            all_articles.append(article)
    
    if not all_articles:
        return "No articles found from any feed."
    
    result = f"📰 All Feeds ({len(all_articles)} articles):\n\n"
    for i, article in enumerate(all_articles[:limit*len(feeds)], 1):
        result += f"{i}. [{article['source']}] **{article['title']}**\n"
        result += f"   {article['link']}\n\n"
    
    return result


@mcp.tool()
def rss_list_sources() -> str:
    """
    List all configured RSS feed sources.
    
    Returns:
        List of all RSS feeds with their names and categories
    """
    feeds = load_feeds()
    
    if not feeds:
        return "No RSS feeds configured. Add feeds via admin panel at http://localhost:3000"
    
    result = "📋 Available RSS Sources:\n\n"
    for feed in feeds:
        result += f"• **{feed['title']}** ({feed.get('category', 'General')})\n"
    
    return result


if __name__ == "__main__":
    mcp.run(transport="stdio")
