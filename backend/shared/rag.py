import os
import logging
from .clients import get_openai_client, get_mongo_db

def generate_embedding(text):
    openai_client = get_openai_client()
    deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
    if not deployment:
        raise ValueError("Embedding deployment not configured")

    try:
        response = openai_client.embeddings.create(input=[text], model=deployment)
        return response.data[0].embedding
    except Exception as e:
        logging.error(f"Error generating embedding: {e}")
        raise e

def perform_vector_search(project_id, query_text, limit=5):
    """
    Generates embedding for query_text and searches in 'docs' collection
    filtered by project_id.
    Returns list of document text.
    """
    db = get_mongo_db()
    
    # 1. Generate Embedding
    try:
        query_vector = generate_embedding(query_text)
    except Exception:
        # Re-raise to let caller handle (e.g. return 500)
        raise

    # 2. Vector Search Pipeline
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "vector",
                "queryVector": query_vector,
                "numCandidates": 100,
                "limit": limit,
                "filter": {
                    "metadata.projectId": project_id
                }
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "metadata": 1,
                "score": { "$meta": "vectorSearchScore" }
            }
        }
    ]

    try:
        logging.info(f"Searching vectors for project_id: {project_id}")
        results = list(db.docs.aggregate(pipeline))
        return results
    except Exception as e:
        logging.error(f"Error searching vectors: {e}")
        raise e
