# Flask Refactor - ASB Room Availability

This branch refactors the original client-side JavaScript application into a Flask web application with proper backend architecture using SQLAlchemy ORM.

## What Changed

### Original Architecture
- **Client-side only**: JavaScript fetched SQL INSERT statements as text and parsed them
- **No server**: Ran directly in browser using `file://` or simple HTTP server
- **Manual parsing**: Custom JavaScript code to extract data from SQL text

### New Flask Architecture
- **Server-side backend**: Flask application handles database queries
- **ORM Models**: SQLAlchemy models represent database tables properly
- **API endpoints**: RESTful endpoints for data access
- **Jinja templates**: Server-rendered HTML with Flask template engine

## Project Structure

```
ASB_Room_Availability/
├── app.py                          # Flask application with routes and models
├── requirements.txt                # Python dependencies
├── Computer Science IA - 2.db MODIFIED.db  # SQLite database
├── templates/
│   ├── base.html                   # Base Jinja template
│   ├── index.html                  # Main application page (Jinja)
│   └── table_display.html          # Test route display template
└── static/
    ├── app.js                      # Original JavaScript (can be updated to use API)
    ├── styles.css                  # Styles
    └── floor-*.png                 # Floor plan images
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install -r requirements.txt
```

### 2. Run the Application

```bash
python app.py
```

The server will start at `http://localhost:5000`

## Available Routes

### Main Application
- `GET /` - Main room availability interface (original functionality)

### Test Routes (Display First 10 Records)
These routes display database query results as HTML tables:

- `GET /test/rooms` - All rooms (first 10)
- `GET /test/rooms/floor/<floor>` - Rooms on specific floor
  - Example: `/test/rooms/floor/1`
- `GET /test/schedules` - All schedule entries (first 10)
- `GET /test/classes` - All class information (first 10)
- `GET /test/occupancy/<day>/<period>/<floor>` - Room occupancy for specific time/floor
  - Example: `/test/occupancy/Day1/P1/1`
- `GET /test/filters` - Available days and periods

### API Endpoints (JSON Responses)
These return JSON data instead of HTML:

- `GET /api/rooms` - All rooms as JSON
- `GET /api/rooms/floor/<floor>` - Rooms by floor as JSON
- `GET /api/occupancy/<day>/<period>/<floor>` - Occupancy data as JSON
- `GET /api/filters` - Filter options (days/periods) as JSON

## Database Models

### RoomInfo
Represents classroom/room data:
- `RoomID` (Primary Key)
- `RoomNumber` (Unique)
- `RoomFloor`
- `RoomType`
- `X, Y` - Coordinates for floor plan overlay
- `Width, Height` - Dimensions for floor plan overlay

### Classes
Represents course information:
- `ClassID` (Primary Key)
- `ClassLevel`
- `ClassNumberOfMeets`
- `Subject`
- `Teacher`

### ClassInfo
Additional schedule-specific class details:
- `ScheduleID` (Primary Key)
- `TeacherName`
- `GradeLevel`
- `ClassName`

### ClassSchedule
Links classes to rooms and time slots:
- `ScheduleID` (Primary Key)
- `ClassID` (Foreign Key → Classes)
- `Day` (Day1-Day6)
- `Period`
- `RoomID` (Foreign Key → RoomInfo)

## Query Functions

The following Python functions replicate the original JavaScript database operations:

### `get_all_rooms(limit=10)`
Returns first N rooms with details.

**Replicates:** Loading all room data from database

### `get_rooms_by_floor(floor, limit=10)`
Returns rooms on a specific floor.

**Replicates:** `state.roomsByFloor.get(floor)` from app.js

### `get_all_schedules(limit=10)`
Returns schedule entries with room information.

**Replicates:** Loading ClassSchedule data

### `get_class_info(limit=10)`
Returns class information (teacher, grade, class name).

**Replicates:** `state.classInfoBySchedule` population

### `get_occupancy(day, period, floor, limit=10)`
Returns which rooms are occupied during a specific time block.

**Replicates:** `getOccupancy(day, period, floor)` from app.js:174-190

**This is the core query** - it performs a JOIN across:
- `RoomInfo` (to get room details)
- `ClassSchedule` (to filter by day/period)
- `ClassInfo` (to get teacher and class name)

### `get_days_and_periods()`
Returns available filter options.

**Replicates:** Building day/period dropdown filters (app.js:138-139)

## Next Steps for Student

### Understanding the Architecture

1. **Compare implementations:**
   - Original: app.js lines 82-140 (text parsing)
   - Flask: app.py lines 76-107 (SQLAlchemy queries)

2. **Trace a query:**
   - Visit `/test/occupancy/Day1/P1/1`
   - Read `get_occupancy()` function in app.py:107-134
   - See how it joins three tables using SQLAlchemy

3. **Understand the coordinate system:**
   - `RoomInfo` stores X, Y, Width, Height
   - These are **absolute pixel coordinates** relative to floor plan images
   - Flask doesn't change this - but now you can query/debug coordinates easily

### Debugging Coordinate Issues

The student was struggling with tooltip alignment. Now they can:

```bash
# Visit these test routes to verify coordinate data:
http://localhost:5000/test/rooms/floor/1
```

This displays actual X, Y, Width, Height values from database. Compare with:
- Floor plan image dimensions (app.js:3-28)
- Whether coordinates make sense for room positions

### API Integration (Optional)

The JavaScript could be updated to use Flask API endpoints:

```javascript
// Instead of:
fetch("Computer Science IA - 2.db OFFICIAL.db")

// Use:
fetch("/api/rooms/floor/1")
fetch("/api/occupancy/Day1/P1/1")
```

This would eliminate all the SQL parsing code in app.js.

## Learning Goals (IB CS IA Context)

This refactor demonstrates:

1. **Proper database architecture**: ORM models vs. text parsing
2. **Separation of concerns**: Backend (Flask) vs. Frontend (JavaScript)
3. **API design**: RESTful endpoints for data access
4. **Debugging tools**: Test routes to inspect data
5. **Query optimization**: Database joins instead of client-side data merging

### Key Questions for Student Reflection

1. Why does `get_occupancy()` use a JOIN instead of fetching data separately?
2. What would break if you deleted the ClassInfo table?
3. How would you add a new filter (e.g., filter by teacher name)?
4. Why do coordinates need to be in the database vs. hardcoded?

## Troubleshooting

### Database file not found
Make sure you're running `python app.py` from the directory containing the `.db` file.

### Import errors
Activate virtual environment and run `pip install -r requirements.txt`

### Port already in use
Change the port in app.py:
```python
app.run(debug=True, port=5001)
```

### No data showing
Check that `Computer Science IA - 2.db MODIFIED.db` contains data:
```bash
sqlite3 "Computer Science IA - 2.db MODIFIED.db" "SELECT COUNT(*) FROM RoomInfo;"
```
