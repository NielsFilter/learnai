import azure.functions as func
import logging
import json
import os
from datetime import datetime
from bson.objectid import ObjectId
from ..shared.auth import verify_token
from ..shared.clients import get_openai_client, get_mongo_db
from ..shared.rag import perform_vector_search

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a quiz request.')

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

    action = req.route_params.get('action')
    db = get_mongo_db()

    if action == 'generate':
        return generate_quiz(req, uid, db)
    elif action == 'submit':
        return submit_quiz(req, uid, db)
    else:
        return func.HttpResponse("Invalid action", status_code=400)

def generate_quiz(req, uid, db):
    try:
        req_body = req.get_json()
        project_id = req_body.get('projectId')
        topic = req_body.get('topic')
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id:
        return func.HttpResponse("projectId is required", status_code=400)

    # Verify project ownership
    project = db.projects.find_one({"_id": ObjectId(project_id), "ownerId": uid})
    if not project:
        return func.HttpResponse("Project not found", status_code=404)

    try:
        if topic:
            logging.info(f"Generating quiz for specific topic: {topic}")
            search_query = topic
        else:
            logging.info("Generating surprise quiz (Surprise Me mode)")
            search_query = generate_surprise_topic(db, project_id)
            logging.info(f"Generated surprise query: {search_query}")
        
        # Use shared RAG
        results = perform_vector_search(project_id, search_query)
        context = "\n\n".join([doc['text'] for doc in results])
        
        if not context:
             docs = list(db.docs.find({"metadata.projectId": project_id}).limit(10))
             if not docs:
                 return func.HttpResponse("No documents found for this project", status_code=400)
             context = "\n\n".join([doc['text'] for doc in docs])
             
    except Exception as e:
        return func.HttpResponse(f"Error preparing quiz context: {str(e)}", status_code=500)

    # Generate Quiz
    openai_client = get_openai_client()
    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") or "gpt-35-turbo"

    prompt = f"""
    Generate a multiple choice quiz with 5 questions based on the following text.
    Return the output as a JSON array of objects.
    Each object should have:
    - "question": string
    - "options": array of 4 strings
    - "correctAnswer": string (must be one of the options)
    - "explanation": string (why the answer is correct)

    Text:
    {context}
    """

    try:
        completion = openai_client.chat.completions.create(
            model=chat_deployment,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={ "type": "json_object" }
        )
        content = completion.choices[0].message.content
        quiz_data = json.loads(content)
        if "questions" in quiz_data:
            questions = quiz_data["questions"]
        elif isinstance(quiz_data, list):
            questions = quiz_data
        else:
             found = False
             for val in quiz_data.values():
                 if isinstance(val, list):
                     questions = val
                     found = True
                     break
             if not found:
                 raise ValueError("Could not parse questions from LLM response")

    except Exception as e:
        logging.error(f"Error generating quiz: {e}")
        return func.HttpResponse("Error generating quiz", status_code=500)

    # Store Quiz
    quiz = {
        "projectId": project_id,
        "userId": uid,
        "questions": questions,
        "createdAt": datetime.utcnow().isoformat()
    }
    result = db.quizzes.insert_one(quiz)
    quiz_id = str(result.inserted_id)

    return func.HttpResponse(
        json.dumps({
            "quizId": quiz_id,
            "questions": questions
        }),
        mimetype="application/json",
        status_code=200
    )

def generate_surprise_topic(db, project_id):
    docs = list(db.docs.find({"metadata.projectId": project_id}))
    if not docs:
        return "General concepts"
    
    summary_text = "\n".join([d.get('summary', '') for d in docs])
    if len(summary_text) > 5000:
        summary_text = summary_text[:5000]

    openai_client = get_openai_client()
    chat_deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") or "gpt-35-turbo"
    
    prompt = f"""
    Based on the following document summaries, generate a search query that covers 5 diverse and interesting topics found in the text.
    Return ONLY the search query string, nothing else.
    
    Summaries:
    {summary_text}
    """
    
    try:
        completion = openai_client.chat.completions.create(
            model=chat_deployment,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error generating surprise topic: {e}")
        return "Key concepts from the project"

def submit_quiz(req, uid, db):
    try:
        req_body = req.get_json()
        quiz_id = req_body.get('quizId')
        answers = req_body.get('answers') # List of selected options (strings) or indices
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not quiz_id or not answers:
        return func.HttpResponse("quizId and answers are required", status_code=400)

    quiz = db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        return func.HttpResponse("Quiz not found", status_code=404)
    
    if quiz['userId'] != uid:
        return func.HttpResponse("Unauthorized", status_code=403)

    questions = quiz['questions']
    score = 0
    results = []

    for i, q in enumerate(questions):
        user_answer = answers[i] if i < len(answers) else None
        correct = user_answer == q['correctAnswer']
        if correct:
            score += 1
        
        results.append({
            "question": q['question'],
            "userAnswer": user_answer,
            "correctAnswer": q['correctAnswer'],
            "isCorrect": correct,
            "explanation": q['explanation']
        })

    # Store Result
    quiz_result = {
        "quizId": quiz_id,
        "projectId": quiz['projectId'],
        "userId": uid,
        "score": score,
        "total": len(questions),
        "results": results,
        "submittedAt": datetime.utcnow().isoformat()
    }
    db.quiz_results.insert_one(quiz_result)

    return func.HttpResponse(
        json.dumps({
            "score": score,
            "total": len(questions),
            "results": results
        }),
        mimetype="application/json",
        status_code=200
    )
