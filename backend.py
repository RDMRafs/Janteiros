import io
import json
import os
import re
import uuid
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
PLANNER_SESSION_DIR = "planner_sessions"

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

DEFAULT_PLANNER_PROFILE = {
    "programName": "",
    "degreeType": "",
    "faculty": "",
    "mandatoryModules": [],
    "electiveModules": [],
    "semesterRecommendations": {},
    "recommendedCoursesHistory": [],
    "selectedCourses": [],
    "completedCourses": [],
    "uploadedDocuments": [],
    "conversationSummary": "",
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


def ensure_planner_session_dir():
    os.makedirs(PLANNER_SESSION_DIR, exist_ok=True)


def session_file_path(session_id):
    ensure_planner_session_dir()
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", session_id or "")
    if not safe_id:
        safe_id = uuid.uuid4().hex
    return os.path.join(PLANNER_SESSION_DIR, f"{safe_id}.json")


def create_empty_planner_session(session_id=None):
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", session_id or "") or uuid.uuid4().hex
    return {
        "sessionId": safe_id,
        "handbook": {
            "fileName": "",
            "rawText": "",
            "chunks": [],
            "structuredProfile": {
                "programName": "",
                "degreeType": "",
                "faculty": "",
                "mandatoryModules": [],
                "electiveModules": [],
                "recommendedSemesterHints": [],
                "summary": "",
            },
        },
        "academicProfile": json.loads(json.dumps(DEFAULT_PLANNER_PROFILE)),
        "conversation": [],
        "lastPlan": {"schedule": [], "rationale": ""},
    }


def load_planner_session(session_id):
    if not session_id:
        return None
    path = session_file_path(session_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except Exception:
        return None


def save_planner_session(session_data):
    path = session_file_path(session_data.get("sessionId"))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)


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


def chunk_text(text, chunk_size=1800, overlap=250):
    clean_text = sanitize_text(text)
    if not clean_text:
        return []

    chunks = []
    start = 0
    while start < len(clean_text):
        end = min(len(clean_text), start + chunk_size)
        chunks.append(clean_text[start:end])
        if end >= len(clean_text):
            break
        start = max(0, end - overlap)
    return chunks


def unique_preserve_order(items):
    seen = set()
    ordered = []
    for item in items:
        normalized = sanitize_text(item)
        if normalized and normalized.lower() not in seen:
            seen.add(normalized.lower())
            ordered.append(normalized)
    return ordered


def extract_modules_with_keywords(lines, keywords):
    matches = []
    for line in lines:
        lowered = line.lower()
        if any(keyword in lowered for keyword in keywords) and 4 <= len(line) <= 140:
            matches.append(line)
    return unique_preserve_order(matches)


def infer_program_profile_from_text(text):
    lines = [sanitize_text(line) for line in text.splitlines() if sanitize_text(line)]
    lowered_text = text.lower()

    program_name = ""
    degree_type = ""
    faculty = ""

    degree_patterns = [
        r"(bachelor(?:'s)?(?: of [a-z &/-]+)?)",
        r"(master(?:'s)?(?: of [a-z &/-]+)?)",
        r"(msc(?: [a-z &/-]+)?)",
        r"(bsc(?: [a-z &/-]+)?)",
    ]
    for line in lines[:40]:
        for pattern in degree_patterns:
            match = re.search(pattern, line, flags=re.IGNORECASE)
            if match:
                degree_type = sanitize_text(match.group(1))
                if not program_name:
                    program_name = sanitize_text(re.sub(pattern, "", line, flags=re.IGNORECASE))
                break
        if program_name and degree_type:
            break

    if not program_name:
        for line in lines[:20]:
            if "informatics" in line.lower() or "science" in line.lower() or "engineering" in line.lower():
                program_name = line
                break

    faculty_match = re.search(r"(school of [a-z ,&-]+|faculty of [a-z ,&-]+|department of [a-z ,&-]+)", lowered_text)
    if faculty_match:
        faculty = sanitize_text(faculty_match.group(1).title())

    mandatory_modules = extract_modules_with_keywords(
        lines,
        ["mandatory", "pflicht", "required", "core module", "obligatory"],
    )
    elective_modules = extract_modules_with_keywords(
        lines,
        ["elective", "wahl", "optional", "specialization", "track"],
    )
    semester_hints = extract_modules_with_keywords(
        lines,
        ["semester 1", "semester 2", "semester 3", "1st semester", "2nd semester", "3rd semester", "sem. 1", "sem. 2"],
    )

    summary_parts = []
    if program_name:
        summary_parts.append(f"Program: {program_name}")
    if degree_type:
        summary_parts.append(f"Degree: {degree_type}")
    if faculty:
        summary_parts.append(f"Faculty: {faculty}")

    return {
        "programName": program_name,
        "degreeType": degree_type,
        "faculty": faculty,
        "mandatoryModules": mandatory_modules[:40],
        "electiveModules": elective_modules[:40],
        "recommendedSemesterHints": semester_hints[:30],
        "summary": " | ".join(summary_parts),
    }


def build_planner_profile_from_handbook(handbook_profile):
    planner_profile = json.loads(json.dumps(DEFAULT_PLANNER_PROFILE))
    planner_profile["programName"] = handbook_profile.get("programName", "")
    planner_profile["degreeType"] = handbook_profile.get("degreeType", "")
    planner_profile["faculty"] = handbook_profile.get("faculty", "")
    planner_profile["mandatoryModules"] = handbook_profile.get("mandatoryModules", [])[:50]
    planner_profile["electiveModules"] = handbook_profile.get("electiveModules", [])[:50]
    planner_profile["uploadedDocuments"] = ["handbook"]
    return planner_profile


def merge_course_entries(existing, new_items):
    merged = list(existing or [])
    seen = {sanitize_text(item.get("courseName", "")).lower() for item in merged if item.get("courseName")}
    for item in new_items or []:
        name = sanitize_text(item.get("courseName", ""))
        if not name or name.lower() in seen:
            continue
        normalized = {
            "courseName": name,
            "semester": sanitize_text(item.get("semester", "")),
            "status": sanitize_text(item.get("status", "")) or "recommended",
            "source": sanitize_text(item.get("source", "")),
        }
        merged.append(normalized)
        seen.add(name.lower())
    return merged


def summarize_conversation(conversation):
    snippets = []
    for turn in conversation[-6:]:
        role = turn.get("role", "user").capitalize()
        message = sanitize_text(turn.get("message", ""))[:180]
        if message:
            snippets.append(f"{role}: {message}")
    return " | ".join(snippets)


def infer_requested_semester(question):
    lowered = question.lower()
    match = re.search(r"(semester|sem\.?)\s*(\d+)", lowered)
    if match:
        return f"Semester {match.group(2)}"
    ordinal_match = re.search(r"(\d+)(st|nd|rd|th)\s+semester", lowered)
    if ordinal_match:
        return f"Semester {ordinal_match.group(1)}"
    return ""


def should_add_recommendations(question):
    lowered = question.lower()
    triggers = [
        "add those",
        "add them",
        "save these",
        "add to my academic profile",
        "include these",
        "select these",
        "use these recommendations",
    ]
    return any(trigger in lowered for trigger in triggers)


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


def initialize_minimal_planner_profile(handbook_profile):
    profile = json.loads(json.dumps(DEFAULT_PLANNER_PROFILE))
    profile["programName"] = handbook_profile.get("programName", "")
    profile["degreeType"] = handbook_profile.get("degreeType", "")
    profile["faculty"] = handbook_profile.get("faculty", "")
    profile["mandatoryModules"] = handbook_profile.get("mandatoryModules", [])[:50]
    profile["electiveModules"] = handbook_profile.get("electiveModules", [])[:50]
    return profile


def run_original_planner_pipeline(prompt, handbook_text, completed_names, persisted_context=""):
    system_prompt = 'Return ONLY JSON: {"schedule": [{"course": "NAME", "time_slot": "TIME", "type": "mandatory|elective"}], "rationale": "HTML", "alternatives": []}'
    user_msg = f"Handbook: {handbook_text}\nAlready done: {completed_names}\nGoal: {prompt}"
    if persisted_context:
        user_msg = f"{user_msg}\nPersisted context: {persisted_context}"

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


def build_minimal_persisted_context(session_data):
    profile = session_data.get("academicProfile", {})
    last_plan = session_data.get("lastPlan", {})
    selected_courses = [item.get("courseName", "") for item in profile.get("selectedCourses", []) if item.get("courseName")]
    saved_plans = list((profile.get("semesterRecommendations") or {}).keys())
    context_parts = []
    if selected_courses:
        context_parts.append(f"Selected courses: {selected_courses[:12]}")
    if saved_plans:
        context_parts.append(f"Saved semester plans: {saved_plans[:6]}")
    if last_plan.get("schedule"):
        context_parts.append(
            f"Latest recommendation set: {[item.get('course', '') for item in last_plan.get('schedule', [])[:10]]}"
        )
    return " | ".join(context_parts)


def update_minimal_planner_state(session_data, response_payload, question):
    profile = session_data.setdefault("academicProfile", json.loads(json.dumps(DEFAULT_PLANNER_PROFILE)))
    semester_label = infer_requested_semester(question) or "Latest recommendation"

    if response_payload.get("schedule"):
        profile.setdefault("semesterRecommendations", {})[semester_label] = response_payload.get("schedule", [])
        profile["recommendedCoursesHistory"] = merge_course_entries(
            profile.get("recommendedCoursesHistory", []),
            [
                {
                    "courseName": item.get("course", ""),
                    "semester": semester_label,
                    "status": "recommended",
                    "source": "planner",
                }
                for item in response_payload.get("schedule", [])
                if item.get("course")
            ],
        )
    profile["completedCourses"] = get_student_history()
    profile["uploadedDocuments"] = unique_preserve_order(
        (profile.get("uploadedDocuments") or [])
        + [session_data.get("handbook", {}).get("fileName", "")]
    )
    profile["conversationSummary"] = summarize_conversation(session_data.get("conversation", []))


def save_latest_plan_to_profile(session_data):
    latest_schedule = session_data.get("lastPlan", {}).get("schedule", [])
    if not latest_schedule:
        return

    profile = session_data.setdefault("academicProfile", json.loads(json.dumps(DEFAULT_PLANNER_PROFILE)))
    inferred_question = ""
    for turn in reversed(session_data.get("conversation", [])):
        if turn.get("role") == "user":
            inferred_question = turn.get("message", "")
            break
    semester_label = infer_requested_semester(inferred_question) or "Latest recommendation"

    profile["selectedCourses"] = merge_course_entries(
        profile.get("selectedCourses", []),
        [
            {
                "courseName": item.get("course", ""),
                "semester": semester_label,
                "status": "selected",
                "source": "accept-plan",
            }
            for item in latest_schedule
            if item.get("course")
        ],
    )
    profile["conversationSummary"] = summarize_conversation(session_data.get("conversation", []))


def planner_state_response(session_data):
    profile = session_data.get("academicProfile", {})
    handbook = session_data.get("handbook", {})
    return {
        "sessionId": session_data.get("sessionId"),
        "hasHandbook": bool(handbook.get("rawText")),
        "handbookFileName": handbook.get("fileName", ""),
        "handbookProfile": handbook.get("structuredProfile", {}),
        "academicProfile": profile,
        "lastPlan": session_data.get("lastPlan", {}),
        "conversation": session_data.get("conversation", []),
    }


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


@app.get("/planner/session")
async def fetch_planner_session(sessionId: str = ""):
    session_data = load_planner_session(sessionId)
    if not session_data:
        session_data = create_empty_planner_session(sessionId)
        save_planner_session(session_data)
    return planner_state_response(session_data)


@app.delete("/planner/session")
async def reset_planner_session(sessionId: str = ""):
    path = session_file_path(sessionId)
    if os.path.exists(path):
        os.remove(path)
    session_data = create_empty_planner_session(sessionId)
    save_planner_session(session_data)
    return planner_state_response(session_data)


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
async def generate_plan(
    prompt: str = Form(...),
    sessionId: str = Form(""),
    handbook: Optional[UploadFile] = File(None),
):
    try:
        session_data = load_planner_session(sessionId) or create_empty_planner_session(sessionId)

        if handbook and handbook.filename:
            handbook_content = await handbook.read()
            handbook_text = extract_text_from_upload(handbook.filename, handbook_content)
            handbook_chunks = chunk_text(handbook_text)
            handbook_profile = infer_program_profile_from_text(handbook_text)

            session_data["handbook"] = {
                "fileName": handbook.filename,
                "rawText": handbook_text,
                "chunks": handbook_chunks,
                "structuredProfile": handbook_profile,
            }
            if not session_data.get("academicProfile") or not session_data["academicProfile"].get("programName"):
                session_data["academicProfile"] = initialize_minimal_planner_profile(handbook_profile)
        elif not session_data.get("handbook", {}).get("rawText"):
            return {"error": "Please upload a handbook to start the planner session."}

        session_data.setdefault("conversation", []).append({"role": "user", "message": prompt})
        completed_data = get_student_history()
        completed_names = [c["courseName"] for c in completed_data]
        persisted_context = build_minimal_persisted_context(session_data)
        response_payload = run_original_planner_pipeline(
            prompt,
            session_data["handbook"]["rawText"],
            completed_names,
            persisted_context,
        )
        if not response_payload:
            return {"error": "Could not generate a planner response."}

        session_data["lastPlan"] = {
            "schedule": response_payload.get("schedule", []),
            "rationale": response_payload.get("rationale", ""),
        }
        session_data["conversation"].append(
            {
                "role": "assistant",
                "message": sanitize_text(response_payload.get("rationale", "")),
            }
        )
        update_minimal_planner_state(session_data, response_payload, prompt)
        save_planner_session(session_data)

        return {
            **response_payload,
            "sessionId": session_data["sessionId"],
            "plannerState": planner_state_response(session_data),
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/plan/followup")
async def plan_followup(question: str = Form(...), sessionId: str = Form(...)):
    try:
        session_data = load_planner_session(sessionId)
        if not session_data or not session_data.get("handbook", {}).get("rawText"):
            return {"error": "Planner session not found. Please upload a handbook first."}

        if should_add_recommendations(question):
            save_latest_plan_to_profile(session_data)
            session_data.setdefault("conversation", []).append({"role": "user", "message": question})
            answer_html = "<p>Your latest recommended courses were added to your academic profile and saved for later planner turns.</p>"
            session_data["conversation"].append({"role": "assistant", "message": "Saved the latest recommended courses to your academic profile."})
            session_data["academicProfile"]["conversationSummary"] = summarize_conversation(session_data.get("conversation", []))
            save_planner_session(session_data)
            return {
                "answer": answer_html,
                "schedule": session_data.get("lastPlan", {}).get("schedule", []),
                "rationale": session_data.get("lastPlan", {}).get("rationale", ""),
                "plannerState": planner_state_response(session_data),
            }

        session_data.setdefault("conversation", []).append({"role": "user", "message": question})
        completed_data = get_student_history()
        completed_names = [c["courseName"] for c in completed_data]
        persisted_context = build_minimal_persisted_context(session_data)
        response_payload = run_original_planner_pipeline(
            question,
            session_data["handbook"]["rawText"],
            completed_names,
            persisted_context,
        )
        if not response_payload:
            return {"error": "Could not generate a planner follow-up response."}

        session_data["lastPlan"] = {
            "schedule": response_payload.get("schedule", []),
            "rationale": response_payload.get("rationale", ""),
        }
        session_data["conversation"].append(
            {
                "role": "assistant",
                "message": sanitize_text(response_payload.get("rationale", "")),
            }
        )
        update_minimal_planner_state(session_data, response_payload, question)
        save_planner_session(session_data)

        return {
            "answer": response_payload.get("rationale", ""),
            "schedule": response_payload.get("schedule", []),
            "rationale": response_payload.get("rationale", ""),
            "plannerState": planner_state_response(session_data),
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/plan/accept")
async def accept_plan(sessionId: str = Form(...)):
    session_data = load_planner_session(sessionId)
    if not session_data:
        return {"error": "Planner session not found."}

    save_latest_plan_to_profile(session_data)
    save_planner_session(session_data)
    return {"status": "success", "plannerState": planner_state_response(session_data)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
