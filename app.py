from flask import Flask, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import and_

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///Computer Science IA - 2.db MODIFIED.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# SQLAlchemy Models
class RoomInfo(db.Model):
    __tablename__ = 'RoomInfo'

    RoomID = db.Column(db.Integer, primary_key=True, autoincrement=True)
    RoomNumber = db.Column(db.Text, nullable=False, unique=True)
    RoomFloor = db.Column(db.Integer, nullable=False)
    RoomType = db.Column(db.Text)
    X = db.Column(db.Integer)
    Y = db.Column(db.Integer)
    Width = db.Column(db.Integer)
    Height = db.Column(db.Integer)

    # Relationship to schedules
    schedules = db.relationship('ClassSchedule', backref='room', lazy=True)

    def __repr__(self):
        return f'<Room {self.RoomNumber} on Floor {self.RoomFloor}>'


class Classes(db.Model):
    __tablename__ = 'Classes'

    ClassID = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ClassLevel = db.Column(db.Text)
    ClassNumberOfMeets = db.Column(db.Integer)
    Subject = db.Column(db.Text)
    Teacher = db.Column(db.Text)

    # Relationship to schedules
    schedules = db.relationship('ClassSchedule', backref='class_info', lazy=True)

    def __repr__(self):
        return f'<Class {self.Subject} - {self.Teacher}>'


class ClassInfo(db.Model):
    __tablename__ = 'ClassInfo'

    ScheduleID = db.Column(db.Integer, primary_key=True)
    TeacherName = db.Column(db.Text)
    GradeLevel = db.Column(db.Text)
    ClassName = db.Column(db.Text)

    def __repr__(self):
        return f'<ClassInfo {self.ClassName} - {self.TeacherName}>'


class ClassSchedule(db.Model):
    __tablename__ = 'ClassSchedule'

    ScheduleID = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ClassID = db.Column(db.Integer, db.ForeignKey('Classes.ClassID'), nullable=False)
    Day = db.Column(db.Text)
    Period = db.Column(db.Text)
    RoomID = db.Column(db.Integer, db.ForeignKey('RoomInfo.RoomID'), nullable=False)

    def __repr__(self):
        return f'<Schedule {self.Day} {self.Period} - Room {self.RoomID}>'


# Query Functions - Replicating JavaScript functionality

def get_all_rooms(limit=10):
    """
    Replicates: Fetching all room info from database
    Returns: First 10 rooms with their details
    """
    rooms = RoomInfo.query.limit(limit).all()
    return [{
        'RoomID': r.RoomID,
        'RoomNumber': r.RoomNumber,
        'Floor': r.RoomFloor,
        'Type': r.RoomType,
        'Coordinates': f'({r.X}, {r.Y})',
        'Dimensions': f'{r.Width}x{r.Height}'
    } for r in rooms]


def get_rooms_by_floor(floor, limit=10):
    """
    Replicates: state.roomsByFloor.get(floor)
    Returns: Rooms on a specific floor
    """
    rooms = RoomInfo.query.filter_by(RoomFloor=floor).limit(limit).all()
    return [{
        'RoomID': r.RoomID,
        'RoomNumber': r.RoomNumber,
        'Type': r.RoomType,
        'Coordinates': f'({r.X}, {r.Y})',
        'Dimensions': f'{r.Width}x{r.Height}'
    } for r in rooms]


def get_all_schedules(limit=10):
    """
    Replicates: Fetching all schedule entries
    Returns: First 10 schedule entries
    """
    schedules = ClassSchedule.query.limit(limit).all()
    return [{
        'ScheduleID': s.ScheduleID,
        'ClassID': s.ClassID,
        'Day': s.Day,
        'Period': s.Period,
        'RoomID': s.RoomID,
        'RoomNumber': s.room.RoomNumber if s.room else 'N/A'
    } for s in schedules]


def get_class_info(limit=10):
    """
    Replicates: Fetching class information
    Returns: First 10 class info entries
    """
    classes = ClassInfo.query.limit(limit).all()
    return [{
        'ScheduleID': c.ScheduleID,
        'Teacher': c.TeacherName,
        'Grade': c.GradeLevel,
        'ClassName': c.ClassName
    } for c in classes]


def get_occupancy(day, period, floor, limit=10):
    """
    Replicates: getOccupancy(day, period, floor) from app.js
    Returns: Rooms occupied during specific day/period on a floor
    """
    # Join ClassSchedule with RoomInfo and ClassInfo
    results = db.session.query(
        RoomInfo, ClassSchedule, ClassInfo
    ).join(
        ClassSchedule, RoomInfo.RoomID == ClassSchedule.RoomID
    ).outerjoin(
        ClassInfo, ClassSchedule.ScheduleID == ClassInfo.ScheduleID
    ).filter(
        and_(
            ClassSchedule.Day == day,
            ClassSchedule.Period == period,
            RoomInfo.RoomFloor == floor
        )
    ).limit(limit).all()

    return [{
        'RoomNumber': room.RoomNumber,
        'Floor': room.RoomFloor,
        'Day': schedule.Day,
        'Period': schedule.Period,
        'Teacher': class_info.TeacherName if class_info else 'N/A',
        'ClassName': class_info.ClassName if class_info else 'N/A',
        'Grade': class_info.GradeLevel if class_info else 'N/A'
    } for room, schedule, class_info in results]


def get_days_and_periods():
    """
    Replicates: Getting unique days and periods for filters
    Returns: Lists of available days and periods
    """
    days = db.session.query(ClassSchedule.Day).distinct().all()
    periods = db.session.query(ClassSchedule.Period).distinct().all()

    return {
        'days': sorted([d[0] for d in days if d[0]]),
        'periods': sorted([p[0] for p in periods if p[0]])
    }


# Routes

@app.route('/')
def index():
    """Main page - will render the Jinja template"""
    return render_template('index.html')


@app.route('/test/rooms')
def test_rooms():
    """Test route: Display first 10 rooms as table"""
    rooms = get_all_rooms()
    return render_template('table_display.html',
                         title='All Rooms (First 10)',
                         data=rooms)


@app.route('/test/rooms/floor/<int:floor>')
def test_rooms_by_floor(floor):
    """Test route: Display rooms on specific floor"""
    rooms = get_rooms_by_floor(floor)
    return render_template('table_display.html',
                         title=f'Rooms on Floor {floor} (First 10)',
                         data=rooms)


@app.route('/test/schedules')
def test_schedules():
    """Test route: Display first 10 schedule entries"""
    schedules = get_all_schedules()
    return render_template('table_display.html',
                         title='Class Schedules (First 10)',
                         data=schedules)


@app.route('/test/classes')
def test_classes():
    """Test route: Display first 10 class info entries"""
    classes = get_class_info()
    return render_template('table_display.html',
                         title='Class Information (First 10)',
                         data=classes)


@app.route('/test/occupancy/<day>/<period>/<int:floor>')
def test_occupancy(day, period, floor):
    """Test route: Display room occupancy for specific day/period/floor"""
    occupancy = get_occupancy(day, period, floor)
    return render_template('table_display.html',
                         title=f'Room Occupancy - {day} {period} Floor {floor}',
                         data=occupancy)


@app.route('/test/filters')
def test_filters():
    """Test route: Display available days and periods"""
    filters = get_days_and_periods()
    return render_template('table_display.html',
                         title='Available Days and Periods',
                         data=[filters])


# API endpoints for JSON responses
@app.route('/api/rooms')
def api_rooms():
    """API: Get all rooms as JSON"""
    return jsonify(get_all_rooms())


@app.route('/api/rooms/floor/<int:floor>')
def api_rooms_by_floor(floor):
    """API: Get rooms by floor as JSON"""
    return jsonify(get_rooms_by_floor(floor))


@app.route('/api/occupancy/<day>/<period>/<int:floor>')
def api_occupancy(day, period, floor):
    """API: Get occupancy data as JSON"""
    return jsonify(get_occupancy(day, period, floor))


@app.route('/api/filters')
def api_filters():
    """API: Get available filter options as JSON"""
    return jsonify(get_days_and_periods())


if __name__ == '__main__':
    app.run(debug=True)
