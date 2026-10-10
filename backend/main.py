import os
import time
import uuid
from datetime import datetime
from typing import Optional, Dict

from fastapi import FastAPI, Query, HTTPException, status, Response, Cookie, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gradescopeapi.classes.connection import GSConnection
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = FastAPI(title="Gradescope UCLA API", version="1.0")

# Secret key for encrypting session cookies
SECRET_KEY = os.getenv("SECRET_KEY", "prod-secret-change-me-in-env")
serializer = URLSafeTimedSerializer(SECRET_KEY)

# Configurable CORS domains
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:80").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Set-Cookie"],
)

# Active session store (session_id -> session dict)
session_store: Dict[str, dict] = {}


class LoginRequest(BaseModel):
    email: str
    password: str


def get_ucla_term_exact(dt: datetime) -> str:
    m_d = (dt.month, dt.day)
    if (1, 1) <= m_d <= (3, 22):
        return "Winter"
    elif (3, 23) <= m_d <= (6, 15):
        return "Spring"
    elif (6, 16) <= m_d <= (9, 20):
        return "Summer"
    else:
        return "Fall"


def get_current_session(session_token: Optional[str] = Cookie(None, alias="session_token")) -> dict:
    """Dependency that extracts and validates the HttpOnly session cookie."""
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Authentication required."
        )

    try:
        data = serializer.loads(session_token, max_age=86400)  # Valid for 24 hours
        session_id = data.get("session_id")
        
        session = session_store.get(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Session expired or invalid."
            )
        return session
    except (BadSignature, SignatureExpired):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid session token."
        )


@app.post("/api/login")
def login(credentials: LoginRequest, response: Response):
    try:
        connection = GSConnection()
        connection.login(credentials.email, credentials.password)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Gradescope credentials."
        )

    session_id = str(uuid.uuid4())
    session_store[session_id] = {
        "connection": connection,
        "email": credentials.email,
        "created_at": time.time(),
    }

    # Issue encrypted HttpOnly cookie
    token = serializer.dumps({"session_id": session_id})
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,  # Prevents client JavaScript from accessing cookie
        samesite="lax",
        secure=False,   # Set to True once running under HTTPS
        max_age=86400,
    )

    return {"status": "success", "email": credentials.email}


@app.post("/api/logout")
def logout(response: Response, session_token: Optional[str] = Cookie(None, alias="session_token")):
    if session_token:
        try:
            data = serializer.loads(session_token, max_age=86400)
            session_store.pop(data.get("session_id"), None)
        except Exception:
            pass

    response.delete_cookie("session_token")
    return {"status": "success", "message": "Logged out"}


@app.get("/api/me")
def check_auth(session: dict = Depends(get_current_session)):
    """Allows frontend to verify session validity on refresh."""
    return {"email": session["email"]}


@app.get("/api/courses")
def get_courses(
    term: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    session: dict = Depends(get_current_session)
):
    connection = session["connection"]

    try:
        courses_dict = connection.account.get_courses()
        
        # Grab all student courses (and optionally instructor courses if needed)
        student_courses = courses_dict.get("student", {})
        matched_courses = []

        for course_id, course in student_courses.items():
            # If term or year are provided, filter by them; otherwise match everything
            match_year = (year is None) or (str(course.year).strip() == str(year).strip())
            match_term = (term is None) or (str(course.semester).strip().title() == term.strip().title())

            if match_year and match_term:
                course_data = {
                    "course_id": course_id,
                    "full_name": course.full_name,
                    "term": getattr(course, "semester", None),
                    "year": getattr(course, "year", None),
                    "assignments": []
                }
                
                assignments = connection.account.get_assignments(course_id)
                for assignment in assignments:
                    course_data["assignments"].append({
                        "assignment_id": assignment.assignment_id,
                        "name": assignment.name,
                        "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                        "submission_status": assignment.submissions_status,
                    })

                matched_courses.append(course_data)

        return {
            "total_matches": len(matched_courses),
            "courses": matched_courses
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))