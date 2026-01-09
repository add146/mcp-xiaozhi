from fastmcp import FastMCP

# Create an MCP server
mcp = FastMCP("ExampleMathServer")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

@mcp.tool()
def greet(name: str) -> str:
    """Greet a user by name."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    print("Starting Example MCP Server on http://127.0.0.1:8000")
    # Run as an SSE server
    mcp.run(transport="sse", port=8000)
