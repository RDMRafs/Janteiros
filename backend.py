import io
import json
import os
import re
import zipfile
from collections import defaultdict
from typing import Optional

import boto3
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pypdf import PdfReader

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
CV_PROFILE_FILE = "cv_profile.json"

SKILL_AREA_RULES = {
    "Programming": ["programming", "python", "java", "c++", "software development", "coding", "informatics"],
    "Algorithms & Data Structures": ["algorithm", "data structure", "automata", "formal language", "complexity"],
    "Software Engineering": ["software engineering", "requirements", "testing", "architecture", "devops", "agile"],
    "Databases": ["database", "sql", "data management", "information systems"],
    "AI / Machine Learning": ["machine learning", "artificial intelligence", "neural", "deep learning", "ai"],
    "Data Science / Statistics": ["statistics", "data science", "probability", "analytics", "optimization"],
    "Web Development": ["web", "frontend", "backend", "javascript", "react", "api", "full stack"],
    "Systems / Networks": ["operating system", "network", "distributed", "systems", "cloud", "security"],
    "Mathematics": ["math", "mathematics", "linear algebra", "calculus", "discrete", "logic"],
    "Business / Economics": ["business", "economics", "finance", "accounting", "management", "entrepreneurship"],
}

AREA_KEYWORDS = {
    "Programming": ["programming", "python", "java", "c", "c++", "oop", "software", "coding", "development"],
    "Algorithms & Data Structures": ["algorithm", "data structure", "optimization", "formal languages", "complexity"],
    "Software Engineering": ["software engineering", "testing", "architecture", "requirements", "scrum", "agile", "git"],
    "Databases": ["database", "sql", "postgres", "mysql", "mongodb", "data modeling"],
    "AI / Machine Learning": ["machine learning", "ai", "neural", "tensorflow", "pytorch", "classification", "llm"],
    "Data Science / Statistics": ["statistics", "data analysis", "pandas", "numpy", "visualization", "regression"],
    "Web Development": ["html", "css", "javascript", "typescript", "react", "vue", "node", "api", "web"],
    "Systems / Networks": ["linux", "network", "cloud", "docker", "kubernetes", "systems", "os"],
    "Mathematics": ["mathematics", "discrete", "linear algebra", "calculus", "probability", "logic"],
    "Business / Economics": ["business", "finance", "economics", "accounting", "market", "strategy"],
}

SECTION_PATTERNS = {
    "education": ["education", "academic background", "studies"],
    "work_experience": ["experience", "work experience", "employment", "professional experience"],
    "projects": ["projects", "project experience", "personal projects"],
    "skills": ["skills", "technical skills", "competencies", "technologies"],
    "certifications": ["certifications", "certificates", "licenses"],
    "languages": ["languages", "language skills"],
}


def normalize_history_item(item):
    if isinstance(item, str):
        return {
            "courseName": item,
            "grade": None,
            "ects": None,
            "semesterCompleted": "",
            "category": "",
        }

    if not isinstance(item, dict):
        return None

    course_name = item.get("courseName") or item.get("course") or ""
    if not course_name:
        return None

    grade = item.get("grade")
    ects = item.get("ects")

    return {
        "courseName": str(course_name).strip(),
        "grade": float(grade) if grade not in ("", None) else None,
        "ects": float(ects) if ects not in ("", None) else None,
        "semesterCompleted": str(item.get("semesterCompleted") or "").strip(),
        "category": str(item.get("category") or "").strip(),
    }


def get_student_history():
    if not os.path.exists(HISTORY_FILE):
        return []

    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []

    normalized = [normalize_history_item(item) for item in data]
    return [item for item in normalized if item]


def save_student_history(history):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def get_cv_profile():
    if not os.path.exists(CV_PROFILE_FILE):
        return None

    try:
        with open(CV_PROFILE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_cv_profile(profile):
    with open(CV_PROFILE_FILE, "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)


def extract_json(text):
    text = text.strip()
    start_index = text.find("{")
    if start_index == -1:
        return None
    text = text[start_index:]
    try:
        decoder = json.JSONDecoder()
        obj, _ = decoder.raw_decode(text)
        return obj
    except Exception:
        return None


def sanitize_text(value):
    return re.sub(r"\s+", " ", (value or "")).strip()


def parse_pdf_bytes(raw_bytes):
    reader = PdfReader(io.BytesIO(raw_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def parse_docx_bytes(raw_bytes):
    with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
    paragraphs = re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml)
    joined = " ".join(paragraphs)
    return joined.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")


def extract_text_from_upload(filename, raw_bytes):
    extension = os.path.splitext(filename.lower())[1]
    if extension == ".pdf":
        return parse_pdf_bytes(raw_bytes)
    if extension == ".txt":
        return raw_bytes.decode("utf-8", errors="ignore")
    if extension == ".docx":
        return parse_docx_bytes(raw_bytes)
    raise ValueError("Unsupported file type. Please upload PDF, TXT, or DOCX.")


def split_into_sections(text):
    sections = {key: "" for key in SECTION_PATTERNS}
    normalized_lines = [line.strip() for line in text.splitlines() if line.strip()]
    current_key = None
    buffer = defaultdict(list)

    for line in normalized_lines:
        lowered = line.lower().strip(":")
        matched_key = None
        for key, aliases in SECTION_PATTERNS.items():
            if lowered in aliases:
                matched_key = key
                break
        if matched_key:
            current_key = matched_key
            continue
        if current_key:
            buffer[current_key].append(line)

    for key in sections:
        sections[key] = "\n".join(buffer[key]).strip()
    return sections


def detect_name_from_cv(text):
    lines = [sanitize_text(line) for line in text.splitlines() if sanitize_text(line)]
    for line in lines[:5]:
        if "@" in line or len(line.split()) > 5:
            continue
        if re.search(r"[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}", line):
            return line
    return lines[0] if lines else ""


def extract_list_items(section_text):
    if not section_text:
        return []
    items = []
    for chunk in re.split(r"[\n,|•·]", section_text):
        value = sanitize_text(chunk)
        if len(value) >= 2:
            items.append(value)
    return items[:25]


def extract_contact_links(text):
    emails = re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    urls = re.findall(r"https?://[^\s)]+", text)
    phones = re.findall(r"\+?\d[\d\s()./-]{7,}\d", text)
    return {
        "emails": sorted(set(emails)),
        "urls": sorted(set(urls)),
        "phones": sorted(set(phones)),
    }


def infer_skill_items(text, sections):
    skill_sources = "\n".join(
        [
            sections.get("skills", ""),
            sections.get("projects", ""),
            sections.get("work_experience", ""),
            text,
        ]
    ).lower()
    collected = []
    for keywords in AREA_KEYWORDS.values():
        for keyword in keywords:
            if keyword.lower() in skill_sources:
                collected.append(keyword)
    common_tools = [
        "python",
        "java",
        "javascript",
        "typescript",
        "sql",
        "react",
        "node",
        "docker",
        "git",
        "aws",
        "excel",
        "pandas",
        "numpy",
    ]
    for tool in common_tools:
        if re.search(rf"\b{re.escape(tool)}\b", skill_sources):
            collected.append(tool)
    return sorted(set(collected))


def parse_cv_text(text, filename):
    sections = split_into_sections(text)
    contact = extract_contact_links(text)
    profile = {
        "fileName": filename,
        "rawText": text,
        "structuredProfile": {
            "name": detect_name_from_cv(text),
            "education": extract_list_items(sections.get("education")),
            "workExperience": extract_list_items(sections.get("work_experience")),
            "projects": extract_list_items(sections.get("projects")),
            "skills": extract_list_items(sections.get("skills")),
            "toolsAndTechnologies": infer_skill_items(text, sections),
            "certifications": extract_list_items(sections.get("certifications")),
            "languages": extract_list_items(sections.get("languages")),
            "contact": contact,
        },
    }
    return profile


def course_matches_keywords(course_text, keywords):
    lowered = course_text.lower()
    return [keyword for keyword in keywords if keyword in lowered]


def grade_weight(grade):
    if grade is None or grade <= 0:
        return 1.0
    if grade <= 1.7:
        return 1.4
    if grade <= 2.3:
        return 1.2
    if grade <= 3.0:
        return 1.0
    return 0.8


def build_academic_profile(courses, academic_text=""):
    area_signals = []
    for area, keywords in SKILL_AREA_RULES.items():
        evidence = []
        total_score = 0.0
        total_ects = 0.0

        for course in courses:
            course_text = " ".join(
                [
                    course.get("courseName", ""),
                    course.get("category", ""),
                    course.get("semesterCompleted", ""),
                ]
            )
            matched = course_matches_keywords(course_text, [keyword.lower() for keyword in keywords])
            if matched:
                ects_weight = 1.0 + min((course.get("ects") or 0.0) / 10.0, 0.5)
                signal = grade_weight(course.get("grade")) * ects_weight
                total_score += signal
                total_ects += course.get("ects") or 0.0
                evidence.append(
                    {
                        "courseName": course.get("courseName"),
                        "grade": course.get("grade"),
                        "ects": course.get("ects"),
                        "matches": matched,
                    }
                )

        if not evidence and academic_text:
            matched = course_matches_keywords(academic_text.lower(), [keyword.lower() for keyword in keywords])
            if matched:
                evidence.append(
                    {
                        "courseName": "Academic documents / handbook",
                        "grade": None,
                        "ects": None,
                        "matches": sorted(set(matched)),
                    }
                )
                total_score += 0.8

        if evidence:
            if total_score >= 3.5:
                confidence = "high"
            elif total_score >= 2.0:
                confidence = "medium"
            else:
                confidence = "emerging"

            area_signals.append(
                {
                    "area": area,
                    "confidence": confidence,
                    "score": round(total_score, 2),
                    "ects": round(total_ects, 1),
                    "evidence": evidence[:5],
                }
            )

    area_signals.sort(key=lambda item: item["score"], reverse=True)
    return area_signals


def cv_contains_any(cv_text, items):
    lowered = cv_text.lower()
    return any(item.lower() in lowered for item in items)


def compare_cv_to_academics(cv_profile, academic_profile, courses):
    cv_text = (cv_profile or {}).get("rawText", "")
    structured = (cv_profile or {}).get("structuredProfile", {})
    present_terms = " ".join(
        [
            cv_text,
            " ".join(structured.get("skills", [])),
            " ".join(structured.get("projects", [])),
            " ".join(structured.get("workExperience", [])),
            " ".join(structured.get("toolsAndTechnologies", [])),
        ]
    ).lower()

    aligned_strengths = []
    missing_highlights = []
    role_directions = []

    for area_signal in academic_profile:
        area = area_signal["area"]
        keywords = AREA_KEYWORDS.get(area, [])
        represented = cv_contains_any(present_terms, keywords)
        top_evidence = [entry["courseName"] for entry in area_signal["evidence"] if entry.get("courseName")]

        if represented:
            aligned_strengths.append(
                {
                    "area": area,
                    "reason": f"Your CV already reflects this study area through matching terminology or project/work evidence.",
                    "evidence": top_evidence[:3],
                    "confidence": area_signal["confidence"],
                }
            )
        else:
            missing_highlights.append(
                {
                    "area": area,
                    "reason": f"This area shows up in your coursework but is weakly represented in the CV.",
                    "evidence": top_evidence[:3],
                    "suggestedKeywords": keywords[:5],
                    "confidence": area_signal["confidence"],
                }
            )

    if cv_profile:
        if not structured.get("projects"):
            missing_highlights.append(
                {
                    "area": "Projects",
                    "reason": "Your coursework suggests concrete technical exposure, but the CV does not clearly surface project proof.",
                    "evidence": [course["courseName"] for course in courses[:3]],
                    "suggestedKeywords": ["course project", "team project", "implementation", "prototype"],
                    "confidence": "medium",
                }
            )

        if not structured.get("skills") and not structured.get("toolsAndTechnologies"):
            missing_highlights.append(
                {
                    "area": "Skills Section",
                    "reason": "A dedicated skills block is missing or too hard to detect, which makes academic strengths less visible to recruiters.",
                    "evidence": [],
                    "suggestedKeywords": ["programming languages", "frameworks", "databases", "tooling"],
                    "confidence": "medium",
                }
            )

    role_mapping = {
        "Programming": "Software Engineering Intern",
        "Algorithms & Data Structures": "Backend Engineering Intern",
        "Software Engineering": "Full-Stack or Product Engineering Intern",
        "Databases": "Data Engineering or Backend Intern",
        "AI / Machine Learning": "ML Engineer Intern or AI Support Intern",
        "Data Science / Statistics": "Data Analyst or Data Science Intern",
        "Web Development": "Frontend or Full-Stack Intern",
        "Systems / Networks": "Platform, Systems, or Cloud Intern",
        "Business / Economics": "Product, FinTech, or Business Analyst Intern",
    }
    for area_signal in academic_profile[:4]:
        role = role_mapping.get(area_signal["area"])
        if role:
            role_directions.append(
                {
                    "role": role,
                    "why": f"Based on your coursework signal in {area_signal['area']} ({area_signal['confidence']} confidence).",
                }
            )

    return {
        "alignedStrengths": aligned_strengths[:6],
        "missingHighlights": missing_highlights[:8],
        "careerDirections": role_directions[:6],
    }


def build_heuristic_html(cv_profile, academic_profile, comparison, question):
    structured = (cv_profile or {}).get("structuredProfile", {})
    strengths_html = "".join(
        f"<li><strong>{item['area']}</strong>: supported by {', '.join(item['evidence']) or 'your CV language'}.</li>"
        for item in comparison["alignedStrengths"][:4]
    ) or "<li>Your CV has room to reflect more of your coursework-backed strengths.</li>"

    gaps_html = "".join(
        f"<li><strong>{item['area']}</strong>: {item['reason']} Suggested CV language: {', '.join(item['suggestedKeywords'][:4])}.</li>"
        for item in comparison["missingHighlights"][:5]
    ) or "<li>No major blind spots were detected from the available data.</li>"

    roles_html = "".join(
        f"<li><strong>{item['role']}</strong>: {item['why']}</li>"
        for item in comparison["careerDirections"][:4]
    ) or "<li>Add more academic context to unlock stronger role recommendations.</li>"

    name = structured.get("name") or "your profile"
    question_line = f"<p><strong>Focus:</strong> {question}</p>" if question else ""
    return f"""
    <div class="analysis-block">
        <h3>CV Intelligence for {name}</h3>
        {question_line}
        <p>This review compares your CV with academic evidence from coursework and uploaded academic context. It treats grades as soft signals, not proof of mastery.</p>
        <h4>Strengths already supported</h4>
        <ul>{strengths_html}</ul>
        <h4>What may be underrepresented</h4>
        <ul>{gaps_html}</ul>
        <h4>Career directions to explore</h4>
        <ul>{roles_html}</ul>
    </div>
    """


def request_llm_cv_analysis(question, cv_profile, academic_profile, comparison, academic_text):
    system_prompt = """
You are a constructive study-to-career copilot.
Return ONLY JSON with this shape:
{
  "summaryHtml": "<div>...</div>",
  "strengths": [{"title": "...", "detail": "..."}],
  "missingFromCv": [{"title": "...", "detail": "...", "suggestions": ["...", "..."]}],
  "careerDirections": [{"role": "...", "reason": "..."}],
  "improvementIdeas": ["...", "..."]
}
Rules:
- Be realistic and supportive.
- Do not claim grades prove ability.
- Use grades only as soft confidence signals.
- Suggest concrete CV improvements and skill/project ideas.
"""
    user_msg = json.dumps(
        {
            "question": question,
            "cvProfile": cv_profile,
            "academicProfile": academic_profile,
            "comparison": comparison,
            "academicContext": academic_text[:4000],
        },
        ensure_ascii=False,
    )
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1800,
            "messages": [{"role": "user", "content": user_msg}],
            "system": system_prompt,
        }
    )
    response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
    raw_resp = json.loads(response.get("body").read())
    return extract_json(raw_resp["content"][0]["text"])


@app.get("/")
async def serve_index():
    return FileResponse("index.html")


@app.get("/script.js")
async def serve_js():
    return FileResponse("script.js")


@app.get("/styles.css")
async def serve_css():
    return FileResponse("styles.css")


@app.get("/history")
async def fetch_history():
    return {"completed_courses": get_student_history()}


@app.post("/history/add")
async def add_to_history(
    course: str = Form(...),
    grade: str = Form(""),
    ects: str = Form(""),
    semesterCompleted: str = Form(""),
    category: str = Form(""),
):
    history = get_student_history()
    if not any(item["courseName"].lower() == course.strip().lower() for item in history):
        history.append(
            normalize_history_item(
                {
                    "courseName": course,
                    "grade": grade,
                    "ects": ects,
                    "semesterCompleted": semesterCompleted,
                    "category": category,
                }
            )
        )
        save_student_history(history)
    return {"status": "success"}


@app.post("/history/update")
async def update_history_entry(
    originalCourseName: str = Form(...),
    courseName: str = Form(...),
    grade: str = Form(""),
    ects: str = Form(""),
    semesterCompleted: str = Form(""),
    category: str = Form(""),
):
    history = get_student_history()
    updated_item = normalize_history_item(
        {
            "courseName": courseName,
            "grade": grade,
            "ects": ects,
            "semesterCompleted": semesterCompleted,
            "category": category,
        }
    )
    for index, item in enumerate(history):
        if item["courseName"] == originalCourseName:
            history[index] = updated_item
            break
    save_student_history(history)
    return {"status": "success"}


@app.post("/history/update_grade")
async def update_grade(course: str = Form(...), grade: float = Form(...)):
    history = get_student_history()
    for item in history:
        if item["courseName"] == course:
            item["grade"] = grade
            break
    save_student_history(history)
    return {"status": "success"}


@app.post("/history/delete")
async def delete_history(course: str = Form(...)):
    history = [item for item in get_student_history() if item["courseName"] != course]
    save_student_history(history)
    return {"status": "success"}


@app.get("/cv/profile")
async def fetch_cv_profile():
    return {"cvProfile": get_cv_profile()}


@app.post("/cv/upload")
async def upload_cv(cv: UploadFile = File(...)):
    raw_bytes = await cv.read()
    extracted_text = extract_text_from_upload(cv.filename, raw_bytes)
    profile = parse_cv_text(extracted_text, cv.filename)
    save_cv_profile(profile)
    return {"status": "success", "cvProfile": profile}


@app.delete("/cv/profile")
async def delete_cv_profile():
    if os.path.exists(CV_PROFILE_FILE):
        os.remove(CV_PROFILE_FILE)
    return {"status": "success"}


@app.post("/cv/intelligence")
async def cv_intelligence(
    question: str = Form("Can you evaluate my CV based on my lectures?"),
    handbook: Optional[UploadFile] = File(None),
    transcript: Optional[UploadFile] = File(None),
    academicNotes: str = Form(""),
):
    try:
        cv_profile = get_cv_profile()
        if not cv_profile:
            return {"error": "Please upload a CV first."}

        academic_docs = []
        for upload in [handbook, transcript]:
            if upload and upload.filename:
                academic_docs.append(extract_text_from_upload(upload.filename, await upload.read()))

        academic_text = "\n".join([academicNotes] + academic_docs).strip()
        history = get_student_history()
        academic_profile = build_academic_profile(history, academic_text)
        comparison = compare_cv_to_academics(cv_profile, academic_profile, history)

        llm_response = None
        try:
            llm_response = request_llm_cv_analysis(question, cv_profile, academic_profile, comparison, academic_text)
        except Exception:
            llm_response = None

        summary_html = (
            (llm_response or {}).get("summaryHtml")
            or build_heuristic_html(cv_profile, academic_profile, comparison, question)
        )
        return {
            "cvProfile": cv_profile,
            "academicProfile": academic_profile,
            "comparison": comparison,
            "analysis": llm_response
            or {
                "summaryHtml": summary_html,
                "strengths": [
                    {
                        "title": item["area"],
                        "detail": f"Supported by coursework such as {', '.join(item['evidence']) or 'your academic documents'}.",
                    }
                    for item in comparison["alignedStrengths"][:4]
                ],
                "missingFromCv": [
                    {
                        "title": item["area"],
                        "detail": item["reason"],
                        "suggestions": item.get("suggestedKeywords", []),
                    }
                    for item in comparison["missingHighlights"][:5]
                ],
                "careerDirections": comparison["careerDirections"][:4],
                "improvementIdeas": [
                    "Translate coursework into 1-2 outcome-oriented bullet points with tools and impact.",
                    "Add projects, labs, or assignments that demonstrate the strongest academic areas.",
                    "Use recruiter-friendly keywords that match the roles you want to target.",
                ],
            },
            "summaryHtml": summary_html,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/theses")
async def search_theses(query: str = ""):
    try:
        resp = requests.get("https://api.srv.nat.tum.de/api/v1/ths/offer", timeout=5)
        all_theses = resp.json().get("hits", [])
        thesis_data = "\n".join(
            [
                f"- {t.get('working_title_en')} ({t.get('supervisor', {}).get('orgs', [{}])[0].get('org_name_en')})"
                for t in all_theses[:15]
            ]
        )
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": f"Match: {query}\n\n{thesis_data}"}],
                "system": "Return ONLY HTML content with <div class='opportunity-card'>. No intro.",
            }
        )
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
        thesis_data = "\n".join(
            [
                f"- {t.get('working_title_en')} ({t.get('supervisor', {}).get('orgs', [{}])[0].get('org_name_en')})"
                for t in all_theses[:20]
            ]
        )
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": f"Match: {query}\n\n{thesis_data}"}],
                "system": "Return ONLY HTML content with <div class='opportunity-card'>. No intro.",
            }
        )
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        res = json.loads(response.get("body").read())
        return {"recommendations": res["content"][0]["text"]}
    except Exception as e:
        return {"error": str(e)}


@app.post("/plan")
async def generate_plan(prompt: str = Form(...), handbook: UploadFile = File(...)):
    try:
        pdf_content = await handbook.read()
        pdf_text = extract_text_from_upload(handbook.filename, pdf_content)
        completed_data = get_student_history()
        completed_names = [c["courseName"] for c in completed_data]
        system_prompt = 'Return ONLY JSON: {"schedule": [{"course": "NAME", "time_slot": "TIME", "type": "mandatory|elective"}], "rationale": "HTML", "alternatives": []}'
        user_msg = f"Handbook: {pdf_text}\nAlready done: {completed_names}\nGoal: {prompt}"
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2500,
                "messages": [{"role": "user", "content": user_msg}],
                "system": system_prompt,
            }
        )
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
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": user_msg}],
                "system": system_prompt,
            }
        )
        response = brt.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=body)
        res = json.loads(response.get("body").read())
        return {"answer": res["content"][0]["text"]}
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
