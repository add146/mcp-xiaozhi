#!/usr/bin/env python3
"""
Brave Search MCP Server (STDIO) - Per-user API key support
"""

import os
import urllib.request
import urllib.parse
import json
from fastmcp import FastMCP

mcp = FastMCP("Brave Search")

BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")

@mcp.tool()
def brave_web_search(query: str, count: int = 10) -> str:
    """
    Search the web using Brave Search API.
    
    Args:
        query: Search query string
        count: Number of results (max 20)
    """
    if not BRAVE_API_KEY:
        return "Error: BRAVE_API_KEY not configured"
    
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.search.brave.com/res/v1/web/search?q={encoded_query}&count={min(count, 20)}"
        
        req = urllib.request.Request(url)
        req.add_header("Accept", "application/json")
        req.add_header("X-Subscription-Token", BRAVE_API_KEY)
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
        
        results = []
        web_results = data.get("web", {}).get("results", [])
        
        for item in web_results[:count]:
            title = item.get("title", "No title")
            url = item.get("url", "")
            description = item.get("description", "")
            results.append(f"**{title}**\n{url}\n{description}\n")
        
        if not results:
            return f"No results found for: {query}"
        
        return "\n---\n".join(results)
    
    except urllib.error.HTTPError as e:
        return f"API Error: {e.code} - {e.reason}"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def brave_news_search(query: str, count: int = 10) -> str:
    """
    Search news using Brave Search API.
    
    Args:
        query: Search query string
        count: Number of results (max 20)
    """
    if not BRAVE_API_KEY:
        return "Error: BRAVE_API_KEY not configured"
    
    try:
        encoded_query = urllib.parse.quote(query)
        url = f"https://api.search.brave.com/res/v1/news/search?q={encoded_query}&count={min(count, 20)}"
        
        req = urllib.request.Request(url)
        req.add_header("Accept", "application/json")
        req.add_header("X-Subscription-Token", BRAVE_API_KEY)
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
        
        results = []
        news_results = data.get("results", [])
        
        for item in news_results[:count]:
            title = item.get("title", "No title")
            url = item.get("url", "")
            description = item.get("description", "")
            age = item.get("age", "")
            results.append(f"**{title}** ({age})\n{url}\n{description}\n")
        
        if not results:
            return f"No news found for: {query}"
        
        return "\n---\n".join(results)
    
    except urllib.error.HTTPError as e:
        return f"API Error: {e.code} - {e.reason}"
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    mcp.run()
