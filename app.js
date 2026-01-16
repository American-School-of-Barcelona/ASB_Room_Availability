const API_URL = "/api/data";

const FLOOR_CONFIG = {
  0: {
    label: "Floor 0",
    image: encodeURI("floor-0.png"),
    width: 1035,
    height: 772,
  },
  1: {
    label: "Floor 1",
    image: encodeURI("floor-1.png"),
    width: 1060,
    height: 684,
  },
  2: {
    label: "Floor 2",
    image: encodeURI("floor-2.png"),
    width: 1222,
    height: 742,
  },
  4: {
    label: "Floor 4",
    image: encodeURI("floor-3.png"),
    width: 544,
    height: 755,
  },
};

const state = {
  roomsById: new Map(),
  roomsByFloor: new Map(),
  classInfoBySchedule: new Map(),
  schedules: [],
  days: [],
  periods: [],
};

const daySelect = document.getElementById("daySelect");
const periodSelect = document.getElementById("periodSelect");
const floorSelect = document.getElementById("floorSelect");
const floorImage = document.getElementById("floorImage");
const roomTableBody = document.getElementById("roomTableBody");


function loadData() {
  return fetch(API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load data (${response.status})`);
      }
      return response.json();
    })
    .then((data) => {
      state.roomsById.clear();
      state.roomsByFloor.clear();
      state.classInfoBySchedule.clear();

      data.rooms.forEach((room) => {
        const roomData = {
          id: room.RoomID,
          number: room.RoomNumber,
          floor: room.RoomFloor,
          type: room.RoomType,
          x: room.X,
          y: room.Y,
          width: room.Width,
          height: room.Height,
        };
        state.roomsById.set(roomData.id, roomData);
        if (!state.roomsByFloor.has(roomData.floor)) {
          state.roomsByFloor.set(roomData.floor, []);
        }
        state.roomsByFloor.get(roomData.floor).push(roomData);
      });

      data.classInfo.forEach((info) => {
        state.classInfoBySchedule.set(info.ScheduleID, {
          scheduleId: info.ScheduleID,
          teacher: info.TeacherName,
          grade: info.GradeLevel,
          className: info.ClassName,
        });
      });

      state.schedules = data.schedules.map((entry) => ({
        scheduleId: entry.ScheduleID,
        classId: entry.ClassID,
        day: entry.Day,
        period: entry.Period,
        roomId: entry.RoomID,
      }));

      state.days = Array.from(new Set(state.schedules.map((s) => s.day))).sort();
      state.periods = Array.from(new Set(state.schedules.map((s) => s.period))).sort();
    });
}

function setOptions(select, values, labeler) {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labeler ? labeler(value) : value;
    select.appendChild(option);
  });
}

function buildFilters() {
  setOptions(daySelect, state.days, (value) => value.replace("Day", "Day "));
  setOptions(periodSelect, state.periods, (value) => value.replace("P", "P "));

  const floors = Array.from(state.roomsByFloor.keys()).sort((a, b) => a - b);
  setOptions(floorSelect, floors, (value) => {
    return FLOOR_CONFIG[value] ? FLOOR_CONFIG[value].label : `Floor ${value}`;
  });

  daySelect.value = state.days[0] || "";
  periodSelect.value = state.periods[0] || "";
  floorSelect.value = floors[0] || "";
}

function currentFilters() {
  return {
    day: daySelect.value,
    period: periodSelect.value,
    floor: Number(floorSelect.value),
  };
}

function getOccupancy(day, period, floor) {
  const occupancy = new Map();
  for (const entry of state.schedules) {
    if (entry.day !== day || entry.period !== period) {
      continue;
    }
    const room = state.roomsById.get(entry.roomId);
    if (!room || room.floor !== floor) {
      continue;
    }
    if (!occupancy.has(room.id)) {
      occupancy.set(room.id, []);
    }
    occupancy.get(room.id).push(entry);
  }
  return occupancy;
}

function drawRooms() {
  const { day, period, floor } = currentFilters();
  const rooms = state.roomsByFloor.get(floor) || [];
  const occupancy = getOccupancy(day, period, floor);

  if (!roomTableBody) {
    return;
  }

  roomTableBody.innerHTML = "";
  rooms
    .slice()
    .sort((a, b) => String(a.number).localeCompare(String(b.number)))
    .forEach((room) => {
      const row = document.createElement("tr");
      const roomCell = document.createElement("td");
      roomCell.textContent = room.number;

      const statusCell = document.createElement("td");
      const useEntries = occupancy.get(room.id);
      if (useEntries && useEntries.length) {
        statusCell.className = "status-used";
        const detail = useEntries.map((entry) => {
          const classInfo = state.classInfoBySchedule.get(entry.scheduleId) || {};
          const teacher = classInfo.teacher || "Unknown";
          const className = classInfo.className || "Class";
          const grade = classInfo.grade ? `Grade ${classInfo.grade}` : "";
          return `${className} - ${teacher}${grade ? ` (${grade})` : ""}`;
        }).join("; ");
        statusCell.textContent = detail;
      } else {
        statusCell.className = "status-open";
        statusCell.textContent = "Available";
      }

      row.appendChild(roomCell);
      row.appendChild(statusCell);
      roomTableBody.appendChild(row);
    });
}

function updateImage() {
  const { floor } = currentFilters();
  const config = FLOOR_CONFIG[floor];
  if (!config) {
    return;
  }
  floorImage.src = config.image;
}

function handleChange() {
  updateImage();
  drawRooms();
}

function init() {
  if (roomTableBody) {
    roomTableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "Loading schedule data...";
    row.appendChild(cell);
    roomTableBody.appendChild(row);
  }

  if (window.location.protocol === "file:") {
    if (roomTableBody) {
      roomTableBody.innerHTML = "";
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = "Open this page with http://localhost:3000 so the data can load.";
      row.appendChild(cell);
      roomTableBody.appendChild(row);
    }
    return;
  }

  loadData().then(() => {
    buildFilters();
    updateImage();
    drawRooms();

    daySelect.addEventListener("change", handleChange);
    periodSelect.addEventListener("change", handleChange);
    floorSelect.addEventListener("change", handleChange);

    floorImage.addEventListener("load", drawRooms);
    window.addEventListener("resize", () => {
      window.requestAnimationFrame(drawRooms);
    });
  }).catch((error) => {
    if (roomTableBody) {
      roomTableBody.innerHTML = "";
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = `Load error: ${error}`;
      row.appendChild(cell);
      roomTableBody.appendChild(row);
    }
    console.error("Data load failed", error);
  });
}

init();
