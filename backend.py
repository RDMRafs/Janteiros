import os
import json
import io
import re
import requests
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

region = os.getenv("AWS_REGION", "eu-central-1")
brt = boto3.client(service_name="bedrock-runtime", region_name=region)

HISTORY_FILE = "student_history.json"

def get_student_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                data = json.load(f)
                if data and isinstance(data[0], str):
                    return [{"course": c, "grade": 0.0} for c in data]
                return data
        except: return []
    return []

def save_student_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f)

def extract_json(text):
    text = text.strip()
    start_index = text.find('{')
    if start_index == -1: return None
    text = text[start_index:]
    try:
        decoder = json.JSONDecoder()
        obj, _ = decoder.raw_decode(text)
        return obj
    except: return None

@app.get("/")
async def serve_index(): return FileResponse("index.html")
@app.get("/script.js")
async def serve_js(): return FileResponse("script.js")
@app.get("/styles.css")
async def serve_css(): return FileResponse("styles.css")

@app.get("/history")
async def fetch_history(): return {"completed_courses": get_student_history()}

@app.post("/history/add")
async def add_to_history(course: str = Form(...), grade: float = Form(0.0)):
    history = get_student_history()
    if not any(item['course'] == course for item in history):
        history.append({"course": course, "grade": grade})
        save_student_history(history)
    return {"status": "success"}

@app.post("/history/update_grade")
async def update_grade(course: str = Form(...), grade: float = Form(...)):
    history = get_student_history()
    for item in history:
        if item['course'] == course:
            item['grade'] = grade
            break
    save_student_history(history)
    return {"status": "success"}

@app.post("/history/delete")
async def delete_history(course: str = Form(...)):
    history = get_student_history()
    history = [item for item in history if item['course'] != course]
    save_student_history(history)
    return {"status": "success"}

@app.get("/theses")
async def search_theses(query: str = ""):
    try:
        resp = requests.get("https://api.srv.nat.tum.de/api/v1/ths/offer", timeout=5)
        all_theses = resp.json().get("hits", [])
        thesis_data = "\n".join([f"- {t.get('working_title_en')} ({t.get('supervisor', {}).get('orgs', [{}])[0].get('org_name_en')})" for t in all_theses[:15]])
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": f"Match: {query}\n\n{thesis_data}"}],
            "system": "Return ONLY HTML content with <div class='opportunity-card'>. No intro."
        })
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        res = json.loads(response.get("body").read())
        return {"recommendations": res["content"][0]["text"]}
    except Exception as e:
        return {"error": str(e)}

@app.get("/jobs")
async def search_jobs(query: str = ""):
    try:
        resp = requests.get("https://api.srv.nat.tum.de/api/v1/ths/offer", timeout=5)
        all_theses = resp.json().get("hits", [])
        thesis_data = "\n".join([f"- {t.get('working_title_en')} ({t.get('supervisor', {}).get('orgs', [{}])[0].get('org_name_en')})" for t in all_theses[:20]])
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": f"Match: {query}\n\n{thesis_data}"}],
            "system": "Return ONLY HTML content with <div class='opportunity-card'>. No intro."
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
        completed_data = get_student_history()
        completed_names = [c['course'] for c in completed_data]
        system_prompt = "Return ONLY JSON: {\"schedule\": [{\"course\": \"NAME\", \"time_slot\": \"TIME\", \"type\": \"mandatory|elective\"}], \"rationale\": \"HTML\", \"alternatives\": []}"
        user_msg = f"Handbook: {pdf_text}\nAlready done: {completed_names}\nGoal: {prompt}"
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2500,
            "messages": [{"role": "user", "content": user_msg}],
            "system": system_prompt
        })
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        raw_resp = json.loads(response.get("body").read())
        return extract_json(raw_resp["content"][0]["text"])
    except Exception as e:
        return {"error": str(e)}

@app.post("/plan/followup")
async def plan_followup(question: str = Form(...), current_plan: str = Form(...)):
    try:
        system_prompt = "You are an academic advisor. Answer the student's question about the plan provided. Return short, helpful HTML."
        user_msg = f"Current Plan: {current_plan}\n\nStudent Question: {question}"
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": user_msg}],
            "system": system_prompt
        })
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        res = json.loads(response.get("body").read())
        return {"answer": res["content"][0]["text"]}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
