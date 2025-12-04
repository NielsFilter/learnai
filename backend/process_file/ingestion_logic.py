import os
import logging
import io
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from azure.ai.documentintelligence.models import AnalyzeResult
from ..shared.clients import get_openai_client, get_document_intelligence_client, get_mongo_db

# Initialize MongoDB Collection
def get_mongo_collection():
    db = get_mongo_db()
    collection = db["docs"] # Collection name
    return collection

def extract_text_from_pdf(file_stream: bytes) -> str:
    """Extracts text from a PDF file stream using Azure Document Intelligence."""
    try:
        client = get_document_intelligence_client()
        
        # Document Intelligence expects a file-like object or bytes
        # For 'begin_analyze_document', we can pass the bytes directly if we use the 'analyze_document' method 
        # but the SDK structure for bytes usually requires a Poller.
        # Let's use the synchronous client's begin_analyze_document which returns a poller.
        
        poller = client.begin_analyze_document(
            "prebuilt-layout", 
            body=file_stream,
            content_type="application/octet-stream"
        )
        result: AnalyzeResult = poller.result()
        
        # Extract text from the result
        # We can also extract tables, selection marks, etc. if needed.
        # For now, we just want the full text content.
        if result.content:
            return result.content
        return ""

    except Exception as e:
        logging.error(f"Error extracting text from PDF with Document Intelligence: {e}")
        raise

def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """Splits text into chunks."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    return text_splitter.split_text(text)

def generate_embeddings(text_chunks: List[str]) -> List[List[float]]:
    """Generates embeddings for a list of text chunks using Azure OpenAI."""
    client = get_openai_client()
    deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")

    # Throw exception if the deployment is not set
    if not deployment:
        raise ValueError("AZURE_OPENAI_EMBEDDING_DEPLOYMENT is not set")
    
    embeddings = []
    # Process in batches to avoid hitting limits if necessary, but for now simple loop
    # OpenAI API can handle multiple inputs
    try:
        response = client.embeddings.create(input=text_chunks, model=deployment)
        # Sort by index to ensure order matches
        data = sorted(response.data, key=lambda x: x.index)
        embeddings = [item.embedding for item in data]
        return embeddings
    except Exception as e:
        logging.error(f"Error generating embeddings: {e}")
        raise

def store_vectors(filename: str, chunks: List[str], embeddings: List[List[float]], project_id: str):
    """Stores text chunks and their embeddings in MongoDB."""
    collection = get_mongo_collection()
    
    docs = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        doc = {
            "filename": filename,
            "chunk_index": i,
            "text": chunk,
            "vector": embedding,
            "metadata": {
                "source": filename,
                "projectId": project_id
            }
        }
        docs.append(doc)
    
    if docs:
        collection.insert_many(docs)
        logging.info(f"Stored {len(docs)} chunks for {filename} in MongoDB.")

def process_document(filename: str, file_stream: bytes, project_id: str = "global"):
    """Orchestrates the document processing flow."""
    logging.info(f"Starting processing for {filename}")
    
    # 1. Extract
    if filename.lower().endswith('.txt'):
        logging.info(f"Processing {filename} as text file")
        try:
            text = file_stream.decode('utf-8')
        except UnicodeDecodeError:
            # Fallback to latin-1 if utf-8 fails
            text = file_stream.decode('latin-1')
    else:
        logging.info(f"Processing {filename} with Document Intelligence")
        text = extract_text_from_pdf(file_stream)
    if not text.strip():
        logging.warning(f"No text extracted from {filename}")
        return

    # 2. Chunk
    chunks = chunk_text(text)
    logging.info(f"Generated {len(chunks)} chunks for {filename}")

    # 3. Embed
    embeddings = generate_embeddings(chunks)
    logging.info(f"Generated {len(embeddings)} embeddings for {filename}")

    # 4. Store
    store_vectors(filename, chunks, embeddings, project_id)
    logging.info(f"Completed processing for {filename}")
