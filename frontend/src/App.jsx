import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import { getCourseColorScheme, hslToHex } from './utils/colorUtils';
import './index.css';

const API_BASE = 'http://localhost:8000';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 21 }, (_, i) => 2015 + i);

export default function App() {
  const calendarRef = useRef(null);

  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Course Data & Collapsible Dropdown State
  const [rawCourses, setRawCourses] = useState([]);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Persisted Color Customizations
  const [customColors, setCustomColors] = useState(() => {
    try {
      const saved = localStorage.getItem('gradescope_course_colors');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Mini Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Check auth session
  useEffect(() => {
    fetch(`${API_BASE}/api/me`, { credentials: 'include' })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then((data) => setUser({ email: data.email }))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error('Invalid Gradescope email or password');
      }

      const data = await res.json();
      setUser({ email: data.email });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
    setRawCourses([]);
    setEvents([]);
  };

  // Fetch course data
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetch(`${API_BASE}/api/courses`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load assignments');
        return res.json();
      })
      .then((data) => {
        setRawCourses(data.courses || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const handleColorChange = (courseKey, hexColor) => {
    const updated = { ...customColors, [courseKey]: hexColor };
    setCustomColors(updated);
    try {
      localStorage.setItem('gradescope_course_colors', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save custom colors', err);
    }
  };

  // Format events with colors and status indicators
  useEffect(() => {
    if (!rawCourses.length) {
      setEvents([]);
      return;
    }

    const formattedEvents = [];
    const now = new Date();

    rawCourses.forEach((course) => {
      const courseKey = course.course_id || course.full_name;
      const colorScheme = getCourseColorScheme(courseKey, customColors);

      course.assignments.forEach((assignment) => {
        if (assignment.due_date) {
          const dueDate = new Date(assignment.due_date);
          const isSubmitted = assignment.submission_status === 'Submitted';

          let statusDotColor = '#3B82F6'; // Default Blue
          let statusText = 'Upcoming';

          if (isSubmitted) {
            statusDotColor = '#22C55E'; // Green
            statusText = 'Submitted';
          } else if (dueDate < now) {
            statusDotColor = '#EF4444'; // Red
            statusText = 'Overdue';
          }

          formattedEvents.push({
            id: assignment.assignment_id,
            title: `[${course.full_name}] ${assignment.name}`,
            start: assignment.due_date,
            backgroundColor: colorScheme.bg,
            borderColor: colorScheme.border,
            textColor: colorScheme.text,
            extendedProps: {
              courseKey,
              courseName: course.full_name,
              assignmentName: assignment.name,
              status: statusText,
              statusColor: statusDotColor,
              dueDate: assignment.due_date,
              isSubmitted,
              score: assignment.score ?? 'N/A',
              maxScore: assignment.max_score ?? 'N/A',
              assignmentUrl: assignment.html_url || null,
              textColor: colorScheme.text,
            },
          });
        }
      });
    });

    setEvents(formattedEvents);
  }, [rawCourses, customColors]);

  const miniCalYear = currentDate.getFullYear();
  const miniCalMonth = currentDate.getMonth();

  const jumpToDate = (newDate) => {
    setCurrentDate(newDate);
    setSelectedDate(newDate);
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(newDate);
    }
  };

  const handleMonthChange = (newMonth) => {
    jumpToDate(new Date(miniCalYear, newMonth, 1));
  };

  const handleYearChange = (newYear) => {
    jumpToDate(new Date(newYear, miniCalMonth, 1));
  };

  const handlePrevMiniMonth = () => {
    jumpToDate(new Date(miniCalYear, miniCalMonth - 1, 1));
  };

  const handleNextMiniMonth = () => {
    jumpToDate(new Date(miniCalYear, miniCalMonth + 1, 1));
  };

  const handleDaySelect = (day) => {
    const targetDate = new Date(miniCalYear, miniCalMonth, day);
    setSelectedDate(targetDate);
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(targetDate);
    }
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getMiniCalDays = () => {
    const firstDayOfWeek = new Date(miniCalYear, miniCalMonth, 1).getDay();
    const daysInMonth = new Date(miniCalYear, miniCalMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(miniCalYear, miniCalMonth, 0).getDate();

    const days = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isCurrentMonth: false, key: `prev-${i}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isCurrentMonth: true, key: `curr-${d}` });
    }

    const totalSlots = days.length > 35 ? 42 : 35;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, key: `next-${i}` });
    }

    return days;
  };

  const filteredEvents = events.filter((ev) =>
    ev.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-icon">📅</div>
            <h2 className="auth-title">Gradescope Sign In</h2>
            <p className="auth-subtitle">
              Sign in to sync your assignment calendar
            </p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label>Gradescope Email</label>
              <input
                type="email"
                name="email"
                required
                className="input-field"
                placeholder="user@university.edu"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                required
                className="input-field"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-viewport">
      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">Calendar</h2>
            <button className="icon-btn" title="Toggle Sidebar">
              📁
            </button>
          </div>

          {/* Search Input */}
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Mini Calendar Widget */}
          <div className="mini-calendar-widget">
            <div className="mini-cal-header">
              <div className="mini-cal-selects">
                <select
                  value={miniCalMonth}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className="mini-cal-select"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m.slice(0, 3)}
                    </option>
                  ))}
                </select>

                <select
                  value={miniCalYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="mini-cal-select"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mini-cal-nav">
                <span onClick={handlePrevMiniMonth}>‹</span>
                <span onClick={handleNextMiniMonth}>›</span>
              </div>
            </div>

            <div className="mini-cal-grid">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="mini-cal-day-header">
                  {d}
                </span>
              ))}
              {getMiniCalDays().map((item) => {
                const cellDate = new Date(miniCalYear, miniCalMonth, item.day);
                const isSelected =
                  item.isCurrentMonth && isSameDay(cellDate, selectedDate);

                return (
                  <span
                    key={item.key}
                    onClick={() =>
                      item.isCurrentMonth && handleDaySelect(item.day)
                    }
                    className={`mini-cal-day ${
                      !item.isCurrentMonth ? 'other-month' : ''
                    } ${isSelected ? 'active' : ''}`}
                  >
                    {item.day}
                  </span>
                );
              })}
            </div>
          </div>

          {/* My Calendars Checklist Section */}
          <div className="section-header">My calendars</div>
          <div className="calendar-list">
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked />
              <span className="checkbox-text">{user.email}</span>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked />
              <span className="checkbox-text">Pending Assignments</span>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" defaultChecked />
              <span className="checkbox-text">Submitted Work</span>
            </label>
          </div>

          {/* Synced Courses Dropdown Menu */}
          <div className="courses-dropdown-container">
            <button
              className="courses-dropdown-toggle"
              onClick={() => setCoursesOpen(!coursesOpen)}
            >
              <span>Synced Courses ({rawCourses.length})</span>
              <span className={`arrow ${coursesOpen ? 'open' : ''}`}>▾</span>
            </button>

            {coursesOpen && (
              <div className="courses-dropdown-menu">
                {rawCourses.length === 0 ? (
                  <div className="empty-courses-text">No courses synced</div>
                ) : (
                  rawCourses.map((course) => {
                    const courseKey = course.course_id || course.full_name;
                    const colorScheme = getCourseColorScheme(courseKey, customColors);
                    const currentHex = hslToHex(colorScheme.hue);

                    return (
                      <div key={courseKey} className="course-item">
                        <div className="course-info-group">
                          <span
                            className="course-dot"
                            style={{ backgroundColor: colorScheme.border }}
                          />
                          <span className="checkbox-text" title={course.full_name}>
                            {course.full_name}
                          </span>
                        </div>

                        <div className="color-picker-wrapper" title="Customize Color">
                          <input
                            type="color"
                            value={currentHex}
                            onChange={(e) => handleColorChange(courseKey, e.target.value)}
                            className="color-picker-input"
                          />
                          <span
                            className="color-picker-dot"
                            style={{
                              backgroundColor: colorScheme.bg,
                              borderColor: colorScheme.text,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <button className="add-calendar-btn">+ Sync Gradescope</button>

          {/* User Sign Out */}
          <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-btn">
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>Syncing assignments from Gradescope...</p>
            </div>
          ) : (
            <div className="calendar-card">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, listPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'title',
                  center: '',
                  right: 'today prev,next dayGridMonth,listMonth',
                }}
                buttonText={{
                  today: 'Today',
                  dayGridMonth: 'Month',
                  listMonth: 'List View',
                }}
                events={filteredEvents}
                eventContent={(eventInfo) => {
                  const { statusColor, textColor } = eventInfo.event.extendedProps;
                  return (
                    <div
                      className="event-pill-inner"
                      style={{ color: textColor || eventInfo.event.textColor }}
                    >
                      <span
                        className="status-dot"
                        style={{ backgroundColor: statusColor }}
                        title={eventInfo.event.extendedProps.status}
                      />
                      <span className="event-pill-text">
                        {eventInfo.event.title}
                      </span>
                    </div>
                  );
                }}
                eventClick={(info) => {
                  setSelectedAssignment(info.event.extendedProps);
                }}
                dayCellClassNames={(arg) =>
                  isSameDay(arg.date, selectedDate) ? 'custom-selected-day' : ''
                }
                datesSet={(arg) => {
                  const activeDate = arg.view.calendar.getDate();
                  setCurrentDate(activeDate);
                }}
                height="100%"
              />
            </div>
          )}
        </main>
      </div>

      {/* Assignment Details Modal */}
      {selectedAssignment && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedAssignment(null)}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-category">Assignment Details</span>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedAssignment(null)}
              >
                ✕
              </button>
            </div>

            <h3 className="modal-title">
              {selectedAssignment.assignmentName}
            </h3>

            <div className="modal-detail-list">
              <div className="modal-detail-row">
                <span className="detail-label">Course:</span>
                <span className="detail-value bold">
                  {selectedAssignment.courseName}
                </span>
              </div>

              <div className="modal-detail-row">
                <span className="detail-label">Due Date:</span>
                <span className="detail-value">
                  📅{' '}
                  {new Date(selectedAssignment.dueDate).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="modal-detail-row">
                <span className="detail-label">Status:</span>
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: `${selectedAssignment.statusColor}20`,
                    color: selectedAssignment.statusColor,
                    border: `1px solid ${selectedAssignment.statusColor}40`,
                  }}
                >
                  <span
                    className="status-dot"
                    style={{ backgroundColor: selectedAssignment.statusColor }}
                  />
                  {selectedAssignment.status}
                </span>
              </div>

              {(selectedAssignment.score !== 'N/A' ||
                selectedAssignment.maxScore !== 'N/A') && (
                <div className="modal-detail-row">
                  <span className="detail-label">Score:</span>
                  <span className="detail-value">
                    {selectedAssignment.score} / {selectedAssignment.maxScore}
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-action-btn primary"
                onClick={() => setSelectedAssignment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}