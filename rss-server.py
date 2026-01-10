"""
RSS MCP Server - Per-user RSS feeds
Reads feeds from users.json based on --user argument
"""
import json
import os
import sys
from fastmcp import FastMCP
import feedparser
from typing import Optional

# Initialize FastMCP server
mcp = FastMCP("RSS News Server")

# Get user ID from arguments
USER_ID = None
for i, arg in enumerate(sys.argv):
    if arg == '--user' and i + 1 < len(sys.argv):
        USER_ID = sys.argv[i + 1]
        break

# Config path
USERS_PATH = os.path.join(os.path.dirname(__file__), "admin-backend", "users.json")

def load_feeds():
    """Load feeds for specific user from users.json"""
    try:
        if os.path.exists(USERS_PATH) and USER_ID:
            with open(USERS_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for user in data.get('users', []):
                    if user.get('id') == USER_ID:
                        feeds = user.get('feeds', [])
                        if feeds:
                            return feeds
    except Exception as e:
        print(f"Error loading feeds: {e}", file=sys.stderr)
    
    # Return empty if no feeds configured
    return []


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


# Create tools for each feed dynamically
feeds = load_feeds()

for feed_config in feeds:
    feed_title = feed_config.get('title', 'Unknown')
    feed_url = feed_config.get('url', '')
    feed_category = feed_config.get('category', 'News')
    
    if not feed_url:
        continue
    
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
    Get latest news from ALL your configured RSS feeds.
    
    Args:
        limit: Number of articles per feed (default 5)
    
    Returns:
        Latest articles from all your feeds
    """
    feeds = load_feeds()
    
    if not feeds:
        return "No RSS feeds configured. Add feeds via admin panel."
    
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
    List all your configured RSS feed sources.
    
    Returns:
        List of all your RSS feeds with their names and categories
    """
    feeds = load_feeds()
    
    if not feeds:
        return "No RSS feeds configured. Add feeds via admin panel."
    
    result = "📋 Your RSS Sources:\n\n"
    for feed in feeds:
        result += f"• **{feed['title']}** ({feed.get('category', 'General')})\n"
    
    return result


if __name__ == "__main__":
    mcp.run(transport="stdio")
