import azure.functions as func
import logging
import json
import os
from datetime import datetime
from datetime import datetime
from shared.auth import authenticate_request
from shared.clients import get_openai_client, get_mongo_db
from shared.rag import perform_vector_search

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a chat request.')
    
    uid = req.user['uid']

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

    # 3. Handle DELETE (Clear History)
    if req.method == 'DELETE':
        project_id = req.params.get('projectId')
        if not project_id:
            return func.HttpResponse("projectId is required", status_code=400)
        
        db = get_mongo_db()
        result = db.chat_history.delete_many({"projectId": project_id, "userId": uid})
        
        return func.HttpResponse(
            json.dumps({"message": "Chat history cleared", "deletedCount": result.deleted_count}),
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
    # 5. RAG - Vector Search (Shared Logic)
    try:
        results = perform_vector_search(project_id, message)
        
        if not results:
             logging.info("Vector search returned no results.")
             # Fallback logic if needed, or just proceeds with empty context
             
    except Exception as e:
        logging.error(f"Error in RAG process: {e}")
        return func.HttpResponse(f"Error searching documents: {str(e)}", status_code=500)

    context = "\n\n".join([doc['text'] for doc in results])
    logging.info(f"LLM Context being sent:\n{context}")
    # 7. Chat Completion
    system_prompt = """You are an expert and encouraging tutor for the LearnAI platform.
Your Goal: Help students understand the topics covered in the provided context using the context as your primary source of truth.
Guidelines:
1. Prioritize Context: Always base your core answers on the provided documents.
2. Supplement Wisely: You are permitted to use your existing knowledge to clarify concepts, define terms, or provide analogies that help explain the material in the context.
3. Handling Missing Info: If a student asks a question relevant to the topic but the specific answer is not in the documents, you may answer using your general knowledge. However, you must preface the answer with: 'This isn't explicitly mentioned in the provided notes, but generally...'
4. Stay on Topic: If the user asks a question completely unrelated to the subject matter of the context (e.g., asking for a recipe during a coding lesson), politely decline and guide them back to the learning material.
5.Tone: Maintain a professional, patient, and encouraging tone.
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {message}"}
    ]

    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") # Need to ensure this env var is set
    if not chat_deployment:
         # Fallback to a default name or error
         chat_deployment = "gpt-4o-mini" # Example

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
