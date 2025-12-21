import os
import logging
import io
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from azure.ai.documentintelligence.models import AnalyzeResult
from shared.clients import get_openai_client, get_document_intelligence_client, get_mongo_db

# Initialize MongoDB Collection
def get_mongo_collection():
    db = get_mongo_db()
    collection = db["docs"] # Collection name
    return collection

def get_documents_collection():
    db = get_mongo_db()
    return db["documents"]

def generate_summary(text: str) -> str:
    """Generates a high-level summary of the document using Azure OpenAI."""
    client = get_openai_client()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_ID") # Use the chat model for summarization

    if not deployment:
        # Fallback or error if chat model deployment env var is different
        # Assuming we use the same deployment as chat or a specific one. 
        # Let's try to use a standard one or the one used for chat if defined.
        # In ProjectDetails it calls /chat, let's see what that uses.
        # For now, I'll assume AZURE_OPENAI_DEPLOYMENT_ID is set for chat/completions.
        deployment = "gpt-4o-mini" # Default fallback or placeholder
    
    # Truncate text if too long to avoid token limits. 
    # 100k chars is roughly 25k tokens, safe for gpt-4o-mini or similar.
    truncated_text = text[:100000] 

    prompt = (
        "You are a helpful study assistant. Please provide a high-level summary of the following document content. "
        "Include the general idea, a breakdown of chapters or key sections, and what the learner should focus on. "
        "Format the output as simple HTML. Use <h1> for the main title, <h2> for sections, <b> for emphasis, and <ul>/<li> or <ol>/<li> for lists. "
        "Do NOT use any CSS classes or inline styling. Do NOT use markdown."
        "\n\nDocument Content:\n" + truncated_text
    )

    try:
        response = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=1000
        )
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Error generating summary: {e}")
        return "Summary generation failed."

def store_document_metadata(filename: str, summary: str, project_id: str):
    """Stores document metadata and summary in MongoDB."""
    collection = get_documents_collection()
    from datetime import datetime
    
    doc = {
        "filename": filename,
        "projectId": project_id,
        "summary": summary,
        "uploadedAt": datetime.utcnow().isoformat()
    }
    
    # Upsert based on filename and projectId to avoid duplicates if re-processed
    collection.update_one(
        {"filename": filename, "projectId": project_id},
        {"$set": doc},
        upsert=True
    )
    logging.info(f"Stored metadata for {filename} in MongoDB.")

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
        if result.pages:
            logging.info(f"Document Intelligence found {len(result.pages)} pages.")
            # Explicitly iterate over pages to ensure we get everything
            full_text = []
            for page in result.pages:
                for line in page.lines:
                    full_text.append(line.content)
            return "\n".join(full_text)
        elif result.content:
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

    # 1.5 Generate and Store Summary
    logging.info(f"Generating summary for {filename}")
    summary = generate_summary(text)
    store_document_metadata(filename, summary, project_id)

    # 2. Chunk
    chunks = chunk_text(text)
    logging.info(f"Generated {len(chunks)} chunks for {filename}")

    # 3. Embed
    embeddings = generate_embeddings(chunks)
    logging.info(f"Generated {len(embeddings)} embeddings for {filename}")

    # 4. Store
    store_vectors(filename, chunks, embeddings, project_id)
    logging.info(f"Completed processing for {filename}")

    # 5. Update Project Status (Decrement processing count)
    try:
        from bson.objectid import ObjectId
        db = get_mongo_db()
        
        # Decrement
        db.projects.update_one(
            {"_id": ObjectId(project_id)},
            {"$inc": {"processingCount": -1}}
        )
        
        # Check if done
        project = db.projects.find_one({"_id": ObjectId(project_id)})
        # If count < 0, reset to 0 just in case. If <= 0, set to ready.
        if project and project.get("processingCount", 0) <= 0:
            db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {"$set": {"status": "ready", "processingCount": 0}}
            )
            logging.info(f"Project {project_id} is now READY.")
            
    except Exception as e:
        logging.error(f"Error updating project status: {e}")
