# Gradescope Assignments Calendar

A modern, responsive React calendar dashboard designed to aggregate, organize, and visualize your Gradescope assignments in real time. Built with an aesthetic inspired by clean productivity tools, it features custom course color hashing, status-coded event indicators, interactive mini-calendar navigation, and detailed assignment modals.

## Features

- **Interactive Main Calendar:** Powered by FullCalendar with customizable Month Grid and Month List views.
- **Smart Mini Calendar:**
  - Year and Month dropdown pickers for rapid date jumping across past and future academic terms.
  - Bidirectional sync with the main calendar.
  - Direct day-cell selection highlighting on the main calendar grid.
- **Scalable & Persistent Color Engine:**
  - **Deterministic HSL Generation:** Automatically generates consistent, high-contrast pastel colors for each course based on its `course_id` using a string-hashing algorithm.
  - **User Color Customization:** Integrated color pickers in the sidebar allow manual course color overrides, persisted locally in `localStorage`.
- **Status Indicator Badges:** Color-coded dots on every event chip indicating submission state:
  - 🟢 **Green:** Submitted assignment.
  - 🔴 **Red:** Overdue (not submitted and due date has passed).
  - 🔵 **Blue:** Upcoming (not submitted and due date is in the future).
- **Detailed Assignment Modal:** Click any assignment to view course name, formatted due date/time, submission status badge, and score breakdown.
- **Synced Courses Dropdown:** Collapsible sidebar menu listing active courses with inline color pickers.
- **Live Search Filtering:** Search bar in the sidebar that filters displayed calendar assignments on the fly.

## Tech Stack

- **Frontend:** React 18+, FullCalendar (`@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/list`)
- **Styling:** Standard CSS (`index.css`) with custom CSS variable tokens, flexbox/grid layouts, and FullCalendar overrides
- **Color Utilities:** Pure JavaScript HSL/Hex hash mapping (`colorUtils.js`)
- **Backend API:** Node.js / Express REST API proxying Gradescope endpoints (`http://localhost:8000`)

## Project Structure

```plaintext
src/
├── components/
│   └── App.jsx           # Main Dashboard, Sidebar, Auth & Modal logic
├── utils/
│   └── colorUtils.js     # Deterministic hash color algorithm & Hex conversion
├── index.css             # Design system tokens, FullCalendar skinning & resets
└── index.js              # React DOM render entry point
```

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v16 or higher) and npm/yarn installed.

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/gradescope-calendar.git
   cd gradescope-calendar
   ```

2. **Install frontend dependencies:**

   ```bash
   npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/list
   ```

3. **Start the development server:**

   ```bash
   npm start
   # or with Vite
   npm run dev
   ```

4. **Start the backend server:**

   Ensure your backend API server is running on `http://localhost:8000` to serve the authentication and course endpoints (`/api/me`, `/api/login`, `/api/courses`).

## API Expectations

The frontend expects a backend running at `http://localhost:8000` providing the following endpoints:

| Method | Endpoint       | Description                                   |
| ------ | -------------- | --------------------------------------------- |
| GET    | `/api/me`      | Validates session authentication              |
| POST   | `/api/login`   | Authenticates Gradescope user credentials     |
| POST   | `/api/logout`  | Clears active authentication session          |
| GET    | `/api/courses` | Returns synced courses and assignment objects |

### Expected Data Structure (`/api/courses`)

```json
{
  "courses": [
    {
      "course_id": "102938",
      "full_name": "CS 101 - Introduction to Computer Science",
      "assignments": [
        {
          "assignment_id": "40291",
          "name": "Homework 1 - Algorithms",
          "due_date": "2026-10-15T23:59:00Z",
          "submission_status": "Submitted",
          "score": 95,
          "max_score": 100,
          "html_url": "https://www.gradescope.com/courses/102938/assignments/40291"
        }
      ]
    }
  ]
}
```

## Color Customization Engine

Course colors are calculated dynamically via `getCourseColorScheme()` in `src/utils/colorUtils.js`:

- **Automatic Hashing:** Hashes `course_id` to an integer modulo 360, returning a unique HSL color scheme with balanced background lightness (94%), border tone (80%), and legible dark text (20%).
- **Custom Overrides:** When a user picks a custom color using the sidebar color picker, the selected Hex value is converted to a Hue angle and saved in `localStorage` under `gradescope_course_colors`.
