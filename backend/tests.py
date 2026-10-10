from gradescopeapi.classes.connection import GSConnection
from dotenv import load_dotenv
import os
from datetime import datetime

def get_ucla_term_exact(dt: datetime) -> str:
    """
    Determines UCLA term based on approximate day-of-month transition thresholds:
    - Winter: Jan 1  – Mar 22
    - Spring: Mar 23 – Jun 15
    - Summer: Jun 16 – Sep 20
    - Fall:   Sep 21 – Dec 31
    """
    m_d = (dt.month, dt.day)

    if (1, 1) <= m_d <= (3, 22):
        return "Winter"
    elif (3, 23) <= m_d <= (6, 15):
        return "Spring"
    elif (6, 16) <= m_d <= (9, 20):
        return "Summer"
    else:  # (9, 21) <= m_d <= (12, 31)
        return "Fall"

#Only works for students, not instructors. Need to add instructor functionality later.
def get_courses_by_term(courses_dict: dict, target_term: str = None, target_year = None) -> dict:
    """
    Filters and prints courses matching the specified term and year.
    Defaults to the current UCLA term and year if not specified.
    
    :param courses_dict: Dictionary returned by connection.account.get_courses()
    :param target_term: Optional term name (e.g., "Winter", "Spring", "Summer", "Fall")
    :param target_year: Optional year (e.g., 2025 or "2025")
    :return: Dictionary of matching {course_id: course_object}
    """
    now = datetime.now()
    
    # Use provided values or fall back to current term/year
    search_term = str(target_term if target_term is not None else get_ucla_term_exact(now)).strip().title()
    search_year = str(target_year if target_year is not None else now.year).strip()

    print(f"Filtering courses for: {search_term} {search_year}...\n")
    
    matched_courses = {}
    student_courses = courses_dict.get('student', {})

    for course_id, course in student_courses.items():
        course_year_str = str(course.year).strip()
        course_semester_str = str(course.semester).strip().title()

        if course_year_str == search_year and course_semester_str == search_term:
            matched_courses[course_id] = course
            print(f"Match: {course.semester} {course.year}")
            print(f"  Course ID: {course_id}")
            print(f"  Name: {course.name}")
            print(f"  Full Name: {course.full_name}")
            print(f"  Assignments: {course.num_assignments}\n")

    print(f"Total Matches Found: {len(matched_courses)}\n")
    return matched_courses

now = datetime.now()
current_year = str(now.year)
current_term = get_ucla_term_exact(now)


# create connection and login
load_dotenv()
connection = GSConnection()
connection.login(os.getenv("GRADESCOPE_EMAIL"), os.getenv("GRADESCOPE_PASSWORD"))
print("Logged in successfully!")

courses = connection.account.get_courses()

# 1. Default usage: Automatically finds current term (e.g., Fall 2026)
active_courses = get_courses_by_term(courses)

# 2. Specify term and year for testing/debugging
winter_2025_courses = get_courses_by_term(courses, target_term="Winter", target_year=2025)