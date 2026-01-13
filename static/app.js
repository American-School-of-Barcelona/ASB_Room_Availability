const SQL_URL = encodeURI("Computer Science IA - 2.db OFFICIAL.db");

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
const roomOverlay = document.getElementById("roomOverlay");
const tooltip = document.getElementById("tooltip");
const mapWrap = document.getElementById("mapWrap");

function parseInsertValues(line) {
  const match = line.match(/VALUES \((.*)\);$/);
  if (!match) {
    return null;
  }
  const raw = match[1];
  const values = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "'") {
      inString = !inString;
      current += ch;
    } else if (ch === "," && !inString) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  values.push(current.trim());
  return values.map((value) => {
    if (value === "NULL") {
      return null;
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1).replace(/''/g, "'");
    }
    return Number(value);
  });
}

function loadSql() {
  return fetch(SQL_URL)
    .then((response) => response.text())
    .then(parseSqlText);
}

function parseSqlText(text) {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith('INSERT INTO "RoomInfo"')) {
      const values = parseInsertValues(line);
      if (!values) {
        continue;
      }
      const room = {
        id: values[0],
        number: values[1],
        floor: values[2],
        type: values[3],
        x: values[4],
        y: values[5],
        width: values[6],
        height: values[7],
      };
      state.roomsById.set(room.id, room);
      if (!state.roomsByFloor.has(room.floor)) {
        state.roomsByFloor.set(room.floor, []);
      }
      state.roomsByFloor.get(room.floor).push(room);
    } else if (line.startsWith('INSERT INTO "ClassInfo"')) {
      const values = parseInsertValues(line);
      if (!values) {
        continue;
      }
      state.classInfoBySchedule.set(values[0], {
        scheduleId: values[0],
        teacher: values[1],
        grade: values[2],
        className: values[3],
      });
    } else if (line.startsWith('INSERT INTO "ClassSchedule"')) {
      const values = parseInsertValues(line);
      if (!values) {
        continue;
      }
      state.schedules.push({
        scheduleId: values[0],
        classId: values[1],
        day: values[2],
        period: values[3],
        roomId: values[4],
      });
    }
  }

  state.days = Array.from(new Set(state.schedules.map((s) => s.day))).sort();
  state.periods = Array.from(new Set(state.schedules.map((s) => s.period))).sort();
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

function showTooltip(content, x, y) {
  tooltip.innerHTML = content;
  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;
  tooltip.classList.add("visible");
  tooltip.setAttribute("aria-hidden", "false");
}

function hideTooltip() {
  tooltip.classList.remove("visible");
  tooltip.setAttribute("aria-hidden", "true");
}

function drawRooms() {
  const { day, period, floor } = currentFilters();
  const rooms = state.roomsByFloor.get(floor) || [];
  const config = FLOOR_CONFIG[floor];
  const rect = floorImage.getBoundingClientRect();

  roomOverlay.innerHTML = "";
  if (!config || rect.width === 0 || rect.height === 0) {
    return;
  }

  if (!config.width || !config.height) {
    return;
  }
  const scaleX = rect.width / config.width;
  const scaleY = rect.height / config.height;
  const occupancy = getOccupancy(day, period, floor);

  rooms.forEach((room) => {
    const roomEl = document.createElement("div");
    roomEl.className = "room";
    roomEl.style.left = `${room.x * scaleX}px`;
    roomEl.style.top = `${room.y * scaleY}px`;
    roomEl.style.width = `${room.width * scaleX}px`;
    roomEl.style.height = `${room.height * scaleY}px`;

    const useEntries = occupancy.get(room.id);
    if (useEntries && useEntries.length) {
      roomEl.classList.add("used");

      roomEl.addEventListener("mouseenter", (event) => {
        const info = useEntries.map((entry) => {
          const classInfo = state.classInfoBySchedule.get(entry.scheduleId) || {};
          const teacher = classInfo.teacher || "Unknown";
          const className = classInfo.className || "Class";
          const grade = classInfo.grade ? `Grade ${classInfo.grade}` : "";
          return `<div><strong>${room.number}</strong> - ${className}</div>` +
            `<div>${teacher}</div>` +
            `<div>${grade}</div>`;
        }).join("<hr class=\"tip-rule\">");

        const mapRect = mapWrap.getBoundingClientRect();
        showTooltip(info, event.clientX - mapRect.left, event.clientY - mapRect.top);
      });

      roomEl.addEventListener("mousemove", (event) => {
        const mapRect = mapWrap.getBoundingClientRect();
        showTooltip(tooltip.innerHTML, event.clientX - mapRect.left, event.clientY - mapRect.top);
      });

      roomEl.addEventListener("mouseleave", () => {
        hideTooltip();
      });
    }

    roomOverlay.appendChild(roomEl);
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
  loadSql().then(() => {
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
  });
}

init();
