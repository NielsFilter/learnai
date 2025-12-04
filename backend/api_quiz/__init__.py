import azure.functions as func
import logging
import json
import os
from datetime import datetime
from bson.objectid import ObjectId
from ..shared.auth import verify_token
from ..shared.clients import get_openai_client, get_mongo_db

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
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)

    if not project_id:
        return func.HttpResponse("projectId is required", status_code=400)

    # Verify project ownership
    project = db.projects.find_one({"_id": ObjectId(project_id), "ownerId": uid})
    if not project:
        return func.HttpResponse("Project not found", status_code=404)

    # Fetch context (limit to some reasonable amount of text)
    # For simplicity, fetch all chunks for the project
    docs = list(db.docs.find({"metadata.projectId": project_id}))
    if not docs:
        return func.HttpResponse("No documents found for this project", status_code=400)
    
    context = "\n\n".join([doc['text'] for doc in docs])
    # Truncate if too long (approx check)
    if len(context) > 10000:
        context = context[:10000]

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
            response_format={ "type": "json_object" } # If supported, or just parse text
        )
        content = completion.choices[0].message.content
        # Ensure it's valid JSON
        quiz_data = json.loads(content)
        # Handle if it's wrapped in a key like "questions"
        if "questions" in quiz_data:
            questions = quiz_data["questions"]
        elif isinstance(quiz_data, list):
            questions = quiz_data
        else:
             # Try to find a list in values
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

    # Return to user (hide correct answers if desired, but for simplicity send everything and frontend hides it? 
    # Or better: strip correct answers. But then submit needs to reference quizId)
    
    client_questions = []
    for q in questions:
        client_questions.append({
            "question": q["question"],
            "options": q["options"]
        })

    return func.HttpResponse(
        json.dumps({
            "quizId": quiz_id,
            "questions": client_questions
        }),
        mimetype="application/json",
        status_code=200
    )

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
