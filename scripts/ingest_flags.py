#!/usr/bin/env python3
"""
Ingest flags into the audit SQLite database for demo/testing.
Usage:
  python scripts/ingest_flags.py --db ./audit.db --count 100
"""
import sqlite3
import uuid
import json
from datetime import datetime, timezone, timedelta
import random
import argparse

SAMPLE_MODELS = [
    ('customer-chatbot-v3','customer_support'),
    ('loan-risk-model-v2','financial_tool'),
    ('sales-forecast-q3','forecasting'),
    ('hr-screening-v1','hr_assistant'),
]

SAMPLE_FLAGS = [
    ('PERFORMANCE','GROUNDING_FAILED'),
    ('RESPONSIBILITY','PII_DETECTED'),
    ('COST','TOKEN_BUDGET_EXCEEDED'),
]

def random_reasoning(model,use_case):
    return {
        'event_id': str(uuid.uuid4()),
        'timestamp': datetime.utcnow().isoformat(),
        'use_case': use_case,
        'model_name': model,
        'policy_applied': use_case,
        'verdict': 'FLAG',
        'flags': [
            {
                'dimension': random.choice(['PERFORMANCE','RESPONSIBILITY','COST']),
                'type': random.choice(['GROUNDING_FAILED','PII_DETECTED','LOW_CONFIDENCE']),
                'severity': random.choice(['LOW','MEDIUM','HIGH']),
                'detail': 'Simulated reason for flag',
            }
        ],
        'steps': [],
        'latency_ms': random.uniform(50,500),
        'user_input_preview': 'Simulated user question...',
        'response_preview': 'Simulated AI response...',
    }


def insert_random(db_path, count=100):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for _ in range(count):
        model,use_case = random.choice(SAMPLE_MODELS)
        flag = random.choice(SAMPLE_FLAGS)
        eid = str(uuid.uuid4())
        ts = datetime.utcnow() - timedelta(minutes=random.randint(0,60*24))
        reasoning = random_reasoning(model,use_case)
        ai_response = reasoning['response_preview']
        verdict = 'FLAG'
        risk_dimension = flag[0]
        flag_type = flag[1]
        confidence_score = round(random.uniform(0.3,0.98),3)
        token_count = random.randint(50,1000)
        latency_ms = round(random.uniform(50,800),2)
        cur.execute('''INSERT INTO audit_logs (id,timestamp,use_case,model_name,user_input,ai_response,verdict,track,risk_dimension,flag_type,confidence_score,reasoning,source_reference,token_count,latency_ms)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
            eid, ts.isoformat(), use_case, model, 'Simulated user input', ai_response, verdict, 'BOTH', risk_dimension, flag_type, confidence_score, json.dumps(reasoning), None, token_count, latency_ms
        ))
    conn.commit()
    conn.close()
    print(f'Inserted {count} rows into {db_path}')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--db', default='./audit.db')
    p.add_argument('--count', type=int, default=100)
    args = p.parse_args()
    insert_random(args.db, args.count)
