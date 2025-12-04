import azure.functions as func
import logging
import json
import os
from datetime import datetime
from ..shared.auth import verify_token
from ..shared.clients import get_openai_client, get_mongo_db

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a chat request.')

    # 1. Verify Token
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return func.HttpResponse("Unauthorized", status_code=401)
    
    token = auth_header.split(' ')[1]
    try:
        user = verify_token(token)
        uid = user['uid']
    except ValueError:
        return func.HttpResponse("Invalid Token", status_code=401)

    # 2. Handle Requests
    if req.method == 'GET':
        project_id = req.params.get('projectId')
        if not project_id:
            return func.HttpResponse("projectId is required", status_code=400)
        
        db = get_mongo_db()
        # Verify ownership (optional but good practice, though history is filtered by userId anyway)
        # But we want to ensure user has access to project history
        
        history = list(db.chat_history.find({"projectId": project_id, "userId": uid}).sort("timestamp", 1))
        for h in history:
            h['_id'] = str(h['_id'])
            
        return func.HttpResponse(
            json.dumps(history),
            mimetype="application/json",
            status_code=200
        )

    # 3. Parse Body (POST)
    try:
        req_body = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)
    
    project_id = req_body.get('projectId')
    message = req_body.get('message')
    
    if not project_id or not message:
        return func.HttpResponse("projectId and message are required", status_code=400)

    # 3. Verify Project Ownership
    db = get_mongo_db()
    project = db.projects.find_one({"_id": project_id}) # Assuming _id is stored as ObjectId or String. In api_projects we stored as ObjectId but returned as str.
    # If we stored as ObjectId, we need to convert string to ObjectId.
    # Let's check api_projects. It inserts using insert_one, so it's ObjectId.
    # We need to import ObjectId.
    from bson.objectid import ObjectId
    try:
        project = db.projects.find_one({"_id": ObjectId(project_id), "ownerId": uid})
    except:
        return func.HttpResponse("Invalid Project ID format", status_code=400)

    if not project:
        return func.HttpResponse("Project not found or access denied", status_code=404)

    # 4. Guardrails (Input)
    # Basic check for malicious intent or jailbreaks
    malicious_keywords = ["ignore instructions", "system prompt", "you are not"]
    if any(keyword in message.lower() for keyword in malicious_keywords):
         return func.HttpResponse("I cannot answer that request.", status_code=400)

    # 5. RAG - Generate Embedding
    openai_client = get_openai_client()
    deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
    if not deployment:
         return func.HttpResponse("Embedding deployment not configured", status_code=500)

    try:
        response = openai_client.embeddings.create(input=[message], model=deployment)
        query_vector = response.data[0].embedding
    except Exception as e:
        logging.error(f"Error generating embedding: {e}")
        return func.HttpResponse("Error generating embedding", status_code=500)

    # 6. RAG - Vector Search
    # We need to perform vector search. MongoDB Atlas Vector Search requires an aggregation pipeline.
    # Assuming the index is named "vector_index" and path is "vector".
    # We also filter by projectId in metadata.
    
    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "vector",
                "queryVector": query_vector,
                "numCandidates": 100,
                "limit": 5,
                "filter": {
                    "metadata.projectId": project_id
                }
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "score": { "$meta": "vectorSearchScore" }
            }
        }
    ]
    
    try:
        results = list(db.docs.aggregate(pipeline))
    except Exception as e:
        logging.error(f"Error searching vectors: {e}")
        # Fallback if vector search fails (e.g. index not ready), maybe just chat without context or fail?
        # For now, let's log and proceed with empty context or fail.
        # If index doesn't exist, this will fail.
        return func.HttpResponse("Error searching documents. Ensure vector index is created.", status_code=500)

    context = "\n\n".join([doc['text'] for doc in results])

    # 7. Chat Completion
    system_prompt = """You are a helpful tutor for the LearnAI platform. 
    Your goal is to help students learn based ONLY on the provided context.
    If the answer is not in the context, say "I don't know based on the provided documents."
    Do not answer questions unrelated to the context.
    Maintain a professional and encouraging tone.
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {message}"}
    ]

    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") # Need to ensure this env var is set
    if not chat_deployment:
         # Fallback to a default name or error
         chat_deployment = "gpt-35-turbo" # Example

    try:
        completion = openai_client.chat.completions.create(
            model=chat_deployment,
            messages=messages,
            temperature=0.7
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        logging.error(f"Error generating chat response: {e}")
        return func.HttpResponse("Error generating response", status_code=500)

    # 8. Store History
    chat_entry = {
        "projectId": project_id,
        "userId": uid,
        "message": message,
        "answer": answer,
        "timestamp": datetime.utcnow().isoformat()
    }
    db.chat_history.insert_one(chat_entry)

    return func.HttpResponse(
        json.dumps({"answer": answer}),
        mimetype="application/json",
        status_code=200
    )
