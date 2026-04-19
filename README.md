# Academic AI Project
# AcademicAI

AcademicAI is an AI-powered student copilot designed to simplify academic life at TUM. Instead of forcing students to navigate many disconnected platforms and sources on their own, AcademicAI provides one central entry point for academic planning, opportunity discovery, and career-oriented support.

The project was developed during the Reply TUM.ai Makeathon 2026.

## Team

**Group:** janteiros

**Members:**
André Thiele
Rafael Curi
Patrick Franke
Joao Pedro Rezende

## The Problem

University life at TUM is spread across many different systems and information sources. Students often have to move between platforms such as TUMonline, Moodle, official university pages, thesis and HiWi postings, degree handbooks, and course-related documents.

This fragmentation creates several problems. Students may struggle to understand which platform they need for a certain task, how to plan their semester correctly, which lectures are mandatory, where to find relevant thesis or HiWi opportunities, and how to connect their academic background to their career development. This is especially difficult for new students, but it also affects enrolled students who need clearer guidance and faster access to relevant information.

## Our Solution

AcademicAI is a student copilot that brings these needs together in one place. It helps students understand their academic profile, explore suitable courses and opportunities, improve their CV based on their studies, and receive actionable recommendations for their next steps.

Instead of acting as just another chatbot, AcademicAI is designed as a practical AI assistant that transforms fragmented academic information into structured guidance, recommendations, and actions.

## Main Features

### Semester Planner

Helps students plan upcoming semesters based on their degree structure, handbook information, and user preferences. It can recommend lectures, identify mandatory modules, and support multi-step academic planning.

### Academic Profile

Builds a structured student profile from uploaded handbooks and academic information. This allows the system to identify the degree program, semester recommendations, mandatory lectures, and relevant academic paths.

### Thesis Finder

Finds relevant thesis opportunities based on the student’s interests, academic background, and context-aware matching.

### Research & HiWi Finder

Searches for research assistant and HiWi opportunities and ranks them according to semantic relevance instead of simple word matching.

### CV Intelligence

Analyzes a student’s CV in relation to their academic background and completed lectures. It highlights missing skills, suggests improvements, and helps students better communicate their strengths.

### Action Center

Acts as a central dashboard that aggregates outputs from the different modules and turns them into concrete next steps. It helps students understand what they should do next, which opportunities matter most, and what is still missing.

## Why AcademicAI Matters

AcademicAI reduces friction in student life by making important information easier to understand and easier to act on. It supports both academic and career-oriented decisions and helps students move from confusion to clarity.

The platform is especially valuable because it connects areas that are usually treated separately:

* academic planning
* degree understanding
* opportunity discovery
* CV improvement
* student action guidance

## Tech Overview

AcademicAI was built as a hackathon project with a focus on practicality, usability, and end-to-end value.

The system combines:

* a modern web interface
* AI-powered analysis and recommendations
* handbook and document parsing
* semantic matching for opportunities
* structured student profile generation
* centralized action generation through the Action Center

## Repository Structure

This repository contains the implementation of the AcademicAI platform, including the frontend, AI-powered feature logic, and integrations or adapters used for the different student support modules.

A typical structure may include:

* frontend pages and components
* feature modules for semester planning, opportunity finding, and CV analysis
* handbook parsing and academic profile logic
* shared action model and Action Center components
* utility logic and shared types

## Running the Project

Clone the repository and install the required dependencies.

```bash
git clone <your-repository-url>
cd <repository-folder>
npm install
npm run dev
```

If the project uses Python services or additional backends, install the required dependencies there as well.

Example:

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn backend:app --reload
```

Adjust the commands according to the actual structure of your project.

## Environment Variables

If the project uses environment variables, create a `.env` file based on the provided example file.

```bash
cp .env.example .env
```

Then fill in the required values.

Important: do not commit your `.env` file or secrets to the repository.

## Future Improvements

AcademicAI was built in a hackathon setting, so there is strong potential for future expansion. Possible next steps include:

* stronger integration with university systems
* more proactive deadline and workflow support
* better course and exam preparation assistance
* richer opportunity application support
* more autonomous action recommendations
* improved persistence and personalization

## Vision

Our vision is to turn AcademicAI into a true campus copilot: a system that not only answers questions, but actively helps students navigate university life, make better decisions, and discover the right academic and professional opportunities at the right time.
