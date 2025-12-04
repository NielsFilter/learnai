import azure.functions as func
import logging
import json
from ..shared.auth import verify_token
from ..shared.clients import get_mongo_db

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a stats request.')

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

    db = get_mongo_db()
    
    # Aggregate stats
    # 1. Quiz results over time
    pipeline = [
        { "$match": { "userId": uid } },
        { "$sort": { "submittedAt": 1 } },
        {
            "$project": {
                "_id": 0,
                "quizId": 1,
                "score": 1,
                "total": 1,
                "submittedAt": 1,
                "projectId": 1
            }
        }
    ]
    
    results = list(db.quiz_results.aggregate(pipeline))
    
    # 2. Average score
    total_score = sum([r['score'] for r in results])
    total_possible = sum([r['total'] for r in results])
    average = (total_score / total_possible * 100) if total_possible > 0 else 0
    
    stats = {
        "history": results,
        "averageScore": round(average, 2),
        "totalQuizzes": len(results)
    }

    return func.HttpResponse(
        json.dumps(stats),
        mimetype="application/json",
        status_code=200
    )
