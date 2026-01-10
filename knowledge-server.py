#!/usr/bin/env python3
"""
Knowledge Base MCP Server - RAG with ChromaDB
Per-user document storage and semantic search
"""
import os
import sys
import json
from typing import Optional
from fastmcp import FastMCP

# Check for required dependencies
try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    print("Error: chromadb not installed. Run: pip install chromadb", file=sys.stderr)
    sys.exit(1)

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Error: sentence-transformers not installed. Run: pip install sentence-transformers", file=sys.stderr)
    sys.exit(1)

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
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")

# Ensure directories exist
os.makedirs(DOCUMENTS_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)

# Embedding function using sentence-transformers
embedding_func = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

def get_user_collection():
    """Get or create collection for current user"""
    if not USER_ID:
        return None
    collection_name = f"user_{USER_ID.replace('-', '_')}_docs"
    return chroma_client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_func
    )

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
        return "PDF support not available. Install: pip install pymupdf"
    try:
        doc = fitz.open(filepath)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        return f"Error reading PDF: {e}"

def extract_text_from_docx(filepath: str) -> str:
    """Extract text from DOCX file"""
    if DocxDocument is None:
        return "DOCX support not available. Install: pip install python-docx"
    try:
        doc = DocxDocument(filepath)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        return f"Error reading DOCX: {e}"

def extract_text_from_txt(filepath: str) -> str:
    """Extract text from TXT file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading TXT: {e}"

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
        return f"Unsupported file type: {ext}"

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """Split text into overlapping chunks"""
    if not text:
        return []
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap
    return chunks


@mcp.tool()
def search_knowledge(query: str, num_results: int = 5) -> str:
    """
    Search your knowledge base for relevant information.
    Uses semantic search to find the most relevant passages from your uploaded documents.
    
    Args:
        query: What you want to search for
        num_results: Number of results to return (default 5, max 10)
    
    Returns:
        Relevant passages from your documents
    """
    collection = get_user_collection()
    if not collection:
        return "Knowledge base not available."
    
    num_results = min(max(num_results, 1), 10)
    
    try:
        results = collection.query(
            query_texts=[query],
            n_results=num_results
        )
        
        if not results['documents'] or not results['documents'][0]:
            return "No relevant information found in your knowledge base."
        
        output = f"🔍 Found {len(results['documents'][0])} relevant passages:\n\n"
        
        for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0]), 1):
            source = metadata.get('source', 'Unknown')
            output += f"**{i}. From: {source}**\n"
            output += f"{doc[:500]}{'...' if len(doc) > 500 else ''}\n\n"
        
        return output
    
    except Exception as e:
        return f"Search error: {e}"


@mcp.tool()
def list_documents() -> str:
    """
    List all documents in your knowledge base.
    
    Returns:
        List of uploaded documents with their details
    """
    docs_dir = get_user_docs_dir()
    if not docs_dir:
        return "Knowledge base not available."
    
    if not os.path.exists(docs_dir):
        return "No documents uploaded yet."
    
    files = os.listdir(docs_dir)
    if not files:
        return "No documents uploaded yet. Upload documents via the admin panel."
    
    output = "📚 Your Documents:\n\n"
    for filename in files:
        filepath = os.path.join(docs_dir, filename)
        size = os.path.getsize(filepath)
        size_str = f"{size / 1024:.1f} KB" if size > 1024 else f"{size} bytes"
        output += f"• **{filename}** ({size_str})\n"
    
    return output


@mcp.tool()
def get_document_info(filename: str) -> str:
    """
    Get information about a specific document.
    
    Args:
        filename: Name of the document
    
    Returns:
        Document details and preview
    """
    docs_dir = get_user_docs_dir()
    if not docs_dir:
        return "Knowledge base not available."
    
    filepath = os.path.join(docs_dir, filename)
    if not os.path.exists(filepath):
        return f"Document '{filename}' not found."
    
    size = os.path.getsize(filepath)
    text = extract_text(filepath)
    preview = text[:1000] + "..." if len(text) > 1000 else text
    
    output = f"📄 **{filename}**\n\n"
    output += f"Size: {size / 1024:.1f} KB\n"
    output += f"Characters: {len(text)}\n\n"
    output += f"**Preview:**\n{preview}"
    
    return output


def index_document(filepath: str, filename: str):
    """Index a document into ChromaDB"""
    collection = get_user_collection()
    if not collection:
        return False
    
    # Extract text
    text = extract_text(filepath)
    if text.startswith("Error"):
        return False
    
    # Chunk text
    chunks = chunk_text(text)
    if not chunks:
        return False
    
    # Add to collection
    try:
        # Delete existing chunks for this file
        existing = collection.get(where={"source": filename})
        if existing['ids']:
            collection.delete(ids=existing['ids'])
        
        # Add new chunks
        ids = [f"{filename}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"source": filename, "chunk": i} for i in range(len(chunks))]
        
        collection.add(
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )
        return True
    except Exception as e:
        print(f"Index error: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    mcp.run(transport="stdio")
