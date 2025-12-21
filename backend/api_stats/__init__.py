import azure.functions as func
import logging
import json
from shared.auth import authenticate_request
from shared.clients import get_mongo_db

@authenticate_request
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a stats request.')
    
    uid = req.user['uid']

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
