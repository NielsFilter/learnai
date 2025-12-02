import os
import logging
import io
from typing import List, Dict, Any
from openai import AzureOpenAI
from pymongo import MongoClient
from langchain_text_splitters import RecursiveCharacterTextSplitter
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeResult

# Initialize Azure OpenAI Client
def get_openai_client():
    return AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version="2023-05-15",
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
    )

# Initialize Document Intelligence Client
def get_document_intelligence_client():
    #TODO: Managed identity...
    endpoint = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    key = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")
    
    if not endpoint or not key:
        raise ValueError("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY must be set")

    return DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))

# Initialize Cosmos DB Client
def get_cosmos_collection():
    connection_string = os.getenv("COSMOS_DB_CONNECTION_STRING")
    if not connection_string:
        raise ValueError("COSMOS_DB_CONNECTION_STRING is not set")
    
    client = MongoClient(connection_string)
    db = client["rag_db"] # Database name
    collection = db["documents"] # Collection name
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
            analyze_request=file_stream,
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
    deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")
    
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

def store_vectors(filename: str, chunks: List[str], embeddings: List[List[float]]):
    """Stores text chunks and their embeddings in Cosmos DB."""
    collection = get_cosmos_collection()
    
    documents = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        doc = {
            "filename": filename,
            "chunk_index": i,
            "text": chunk,
            "vector": embedding,
            "metadata": {
                "source": filename
            }
        }
        documents.append(doc)
    
    if documents:
        collection.insert_many(documents)
        logging.info(f"Stored {len(documents)} chunks for {filename} in Cosmos DB.")

def process_document(filename: str, file_stream: bytes):
    """Orchestrates the document processing flow."""
    logging.info(f"Starting processing for {filename}")
    
    # 1. Extract
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
    store_vectors(filename, chunks, embeddings)
    logging.info(f"Completed processing for {filename}")
