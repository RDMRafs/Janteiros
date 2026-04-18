import os
import json
import io
import re
import requests
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import boto3
from pypdf import PdfReader
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use the region from .env
region = os.getenv("AWS_REGION", "eu-central-1")
brt = boto3.client(service_name="bedrock-runtime", region_name=region)

HISTORY_FILE = "student_history.json"

def get_student_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
        except: return []
    return []

def save_student_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f)

def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?', '', text)
        text = re.sub(r'```$', '', text)
    text = text.strip()
    start_index = text.find('{')
    if start_index == -1: return None
    text = text[start_index:]
    try:
        decoder = json.JSONDecoder()
        obj, _ = decoder.raw_decode(text)
        return obj
    except: return None

@app.get("/history")
async def fetch_history():
    return {"completed_courses": get_student_history()}

@app.post("/history/add")
async def add_to_history(course: str = Form(...)):
    history = get_student_history()
    if course not in history:
        history.append(course)
        save_student_history(history)
    return {"status": "success"}

@app.get("/theses")
async def search_theses(query: str = ""):
    try:
        resp = requests.get("https://api.srv.nat.tum.de/api/v1/ths/offer")
        all_theses = resp.json().get("hits", [])
        thesis_data = "\n".join([f"- {t.get('working_title_en')} ({t.get('supervisor', {}).get('orgs', [{}])[0].get('org_name_en')})" for t in all_theses[:10]])
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": f"Match theses for: {query}\n\n{thesis_data}"}],
            "system": "You are a TUM advisor. Recommend 3 theses in HTML."
        })
        # Haiku is highly compatible with on-demand requests
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        res = json.loads(response.get("body").read())
        return {"recommendations": res["content"][0]["text"]}
@app.get("/jobs")
async def search_jobs(query: str = ""):
    try:
        resp = requests.get("https://api.srv.nat.tum.de/api/v1/ths/offer")
        all_theses = resp.json().get("hits", [])
        # We use the same pool but change the system prompt to filter for assistant roles
        thesis_data = "\n".join([f"- {t.get('working_title_en')} ({t.get('supervisor', {}).get('orgs', [{}])[0].get('org_name_en')})" for t in all_theses[:20]])
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": f"Student skills/interests: {query}\n\nPositions:\n{thesis_data}"}],
            "system": "You are a TUM Career Advisor. Find student assistant (HiWi), research project, or working student roles in the list. Recommend 3 in HTML."
        })
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        res = json.loads(response.get("body").read())
        return {"recommendations": res["content"][0]["text"]}
    except Exception as e:
        return {"error": str(e)}

@app.post("/plan")
async def generate_plan(prompt: str = Form(...), handbook: UploadFile = File(...)):
    try:
        pdf_content = await handbook.read()
        reader = PdfReader(io.BytesIO(pdf_content))
        pdf_text = "\n".join([p.extract_text() for p in reader.pages])
        completed = get_student_history()
        
        system_prompt = "Return ONLY a JSON object. You MUST extract at least 3-5 courses from the handbook. Format: {\"schedule\": [{\"course\": \"Name\", \"time_slot\": \"Time\", \"type\": \"mandatory/elective\"}], \"rationale\": \"HTML\", \"alternatives\": []}"
        user_msg = f"Handbook content: {pdf_text}\n\nStudent already completed: {completed}\n\nGoal: {prompt}"

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": user_msg}],
            "system": system_prompt
        })

        # Haiku is highly compatible with on-demand requests
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        raw_resp = json.loads(response.get("body").read())
        text = raw_resp["content"][0]["text"]
        print(f"DEBUG RESPONSE: {text[:200]}")
        
        return extract_json(text)
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
