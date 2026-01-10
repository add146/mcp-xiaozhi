#!/usr/bin/env python3
"""
Simple Knowledge Base MCP Server - Keyword Search
Lightweight document search without RAG/ChromaDB
"""
import os
import sys
import re
from typing import Optional
from fastmcp import FastMCP

# Check for optional dependencies
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

# Initialize FastMCP
mcp = FastMCP("Knowledge Base")

# Get user ID from arguments
USER_ID = None
for i, arg in enumerate(sys.argv):
    if arg == '--user' and i + 1 < len(sys.argv):
        USER_ID = sys.argv[i + 1]
        break

# Paths
BASE_DIR = os.path.dirname(__file__)
DOCUMENTS_DIR = os.path.join(BASE_DIR, "documents")

def get_user_docs_dir():
    """Get user's document directory"""
    if not USER_ID:
        return None
    user_dir = os.path.join(DOCUMENTS_DIR, USER_ID)
    os.makedirs(user_dir, exist_ok=True)
    return user_dir

def extract_text_from_pdf(filepath: str) -> str:
    """Extract text from PDF file"""
    if fitz is None:
        return "[PDF support not available. Install: pip install pymupdf]"
    try:
        doc = fitz.open(filepath)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        return f"[Error reading PDF: {e}]"

def extract_text_from_docx(filepath: str) -> str:
    """Extract text from DOCX file"""
    if DocxDocument is None:
        return "[DOCX support not available. Install: pip install python-docx]"
    try:
        doc = DocxDocument(filepath)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        return f"[Error reading DOCX: {e}]"

def extract_text_from_txt(filepath: str) -> str:
    """Extract text from TXT file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"[Error reading TXT: {e}]"

def extract_text(filepath: str) -> str:
    """Extract text from file based on extension"""
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.pdf':
        return extract_text_from_pdf(filepath)
    elif ext in ['.docx', '.doc']:
        return extract_text_from_docx(filepath)
    elif ext == '.txt':
        return extract_text_from_txt(filepath)
    else:
        return f"[Unsupported file type: {ext}]"

def simple_search(text: str, query: str) -> list:
    """Simple keyword search - returns matching sentences/paragraphs"""
    query_words = query.lower().split()
    
    # Split text into paragraphs
    paragraphs = text.split('\n')
    matches = []
    
    for para in paragraphs:
        para = para.strip()
        if not para or len(para) < 10:
            continue
        
        para_lower = para.lower()
        # Check if any query word is in paragraph
        if any(word in para_lower for word in query_words):
            matches.append(para)
    
    return matches


@mcp.tool()
def search_documents(query: str, max_results: int = 10) -> str:
    """
    Search for text across all your documents using keyword matching.
    
    Args:
        query: Keywords to search for
        max_results: Maximum number of results (default 10)
    
    Returns:
        Matching text passages from your documents
    """
    docs_dir = get_user_docs_dir()
    if not docs_dir:
        return "Knowledge base not available."
    
    if not os.path.exists(docs_dir):
        return "No documents uploaded yet."
    
    files = os.listdir(docs_dir)
    if not files:
        return "No documents uploaded. Upload via admin panel."
    
    all_matches = []
    
    for filename in files:
        filepath = os.path.join(docs_dir, filename)
        text = extract_text(filepath)
        matches = simple_search(text, query)
        
        for match in matches[:3]:  # Max 3 per file
            all_matches.append({
                'source': filename,
                'text': match[:500]  # Limit text length
            })
    
    if not all_matches:
        return f"No results found for: {query}"
    
    output = f"🔍 Found {min(len(all_matches), max_results)} results for '{query}':\n\n"
    
    for i, m in enumerate(all_matches[:max_results], 1):
        output += f"**{i}. From: {m['source']}**\n"
        output += f"{m['text']}\n\n"
    
    return output


@mcp.tool()
def list_documents() -> str:
    """
    List all documents in your knowledge base.
    
    Returns:
        List of uploaded documents with sizes
    """
    docs_dir = get_user_docs_dir()
    if not docs_dir:
        return "Knowledge base not available."
    
    if not os.path.exists(docs_dir):
        return "No documents uploaded yet."
    
    files = os.listdir(docs_dir)
    if not files:
        return "No documents uploaded. Upload via admin panel."
    
    output = "📚 Your Documents:\n\n"
    for filename in files:
        filepath = os.path.join(docs_dir, filename)
        size = os.path.getsize(filepath)
        size_str = f"{size / 1024:.1f} KB" if size > 1024 else f"{size} bytes"
        output += f"• **{filename}** ({size_str})\n"
    
    return output


@mcp.tool()
def read_document(filename: str, max_chars: int = 5000) -> str:
    """
    Read the content of a specific document.
    
    Args:
        filename: Name of the document to read
        max_chars: Maximum characters to return (default 5000)
    
    Returns:
        Document content (may be truncated)
    """
    docs_dir = get_user_docs_dir()
    if not docs_dir:
        return "Knowledge base not available."
    
    filepath = os.path.join(docs_dir, filename)
    if not os.path.exists(filepath):
        return f"Document '{filename}' not found."
    
    text = extract_text(filepath)
    
    if len(text) > max_chars:
        text = text[:max_chars] + f"\n\n... [Truncated, {len(text)} total characters]"
    
    return f"📄 **{filename}**\n\n{text}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
