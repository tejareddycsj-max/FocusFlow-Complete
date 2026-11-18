/* FocusFlow application logic */
// Authentication check
const authToken = localStorage.getItem("token");
const loggedInUser = JSON.parse(localStorage.getItem("user") || "null");

if (!authToken || !loggedInUser || !loggedInUser.id) {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.replace("login.html");
  throw new Error("Authentication required.");
}

// Keep browser-stored data separate for each logged-in account.
function userStorageKey(key) {
  return `ff_${loggedInUser.id}_${key}`;
}
const DEFAULT_TASKS = [
  { id: "task-1", title: "Arrays and Operations", subject: "Data Structures", priority: "High", deadline: "", day: "mon", duration: 60, status: "pending", rating: 3 },
  { id: "task-2", title: "SQL Joins", subject: "DBMS", priority: "Medium", deadline: "", day: "tue", duration: 45, status: "pending", rating: 3 },
  { id: "task-3", title: "Inheritance", subject: "Java", priority: "Low", deadline: "", day: "wed", duration: 30, status: "completed", rating: 4 }
];

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(userStorageKey(key));
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

const state = {
  profile: readStorage("profile", {
    name: loggedInUser.name || "Student",
    email: loggedInUser.email || "",
    department: "Computer Science Engineering",
    year: "3rd Year",
    dailyGoal: 4
  }),
  tasks: readStorage("tasks", DEFAULT_TASKS),
  sessions: readStorage("sessions", []),
  streak: Number(localStorage.getItem(userStorageKey("streak")) || 5),
  xp: Number(localStorage.getItem(userStorageKey("xp")) || 0),
  theme: localStorage.getItem(userStorageKey("theme")) || "light",
  taskFilter: "all",
  timer: {
    mode: "pomodoro",
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    intervalId: null,
    isRunning: false
  }
};

let productivityChart = null;
let subjectChart = null;
let plannedActualChart = null;
let toastTimeout = null;

const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const dayNames = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};

const API_BASE_URL = "http://localhost:5000/api";

// Backend API helper
async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        ...(options.headers || {})
      }
    });
  } catch (error) {
    console.error(`Network error while requesting ${path}:`, error);
    throw new Error(
      `Cannot connect to the FocusFlow backend at ${API_BASE_URL}. Make sure the backend is running. (${error.message})`
    );
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error(`Invalid JSON response from ${path}:`, responseText);
      throw new Error(`The backend returned an invalid response (${response.status}).`);
    }
  }

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.replace("login.html");
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText || "API request failed";
    throw new Error(`${message} (HTTP ${response.status})`);
  }

  return data;
}

// Convert backend task format into frontend task format
function taskFromApi(task) {
  return {
    id: task.id,
    title: task.title,
    subject: task.subject,
    priority: task.priority,
    deadline: task.deadline || "",
    day: task.day || "",
    duration: Math.round((Number(task.plannedHours) || 0) * 60),
    status: task.status,
    rating: task.rating
  };
}

// Load tasks from database
async function loadTasksFromApi() {
  try {
    const tasks = await apiRequest("/tasks");

    state.tasks = tasks.map(taskFromApi);

    saveAll();

    console.log("Tasks loaded from database:", state.tasks);
  } catch (error) {
    console.error("Failed to load tasks:", error);
    showNotification("Could not load tasks from the database.");
  }
}
// Load study sessions from database
async function loadSessionsFromApi() {
  try {
    const data = await apiRequest("/sessions/stats");

    state.sessions = (data.sessions || []).map(session => ({
      ...session,
      durationMinutes: Math.round(
        Number(session.durationSeconds) / 60
      ),
      completedAt: session.createdAt
    }));

    saveAll();

    console.log(
      "Study sessions loaded from database:",
      state.sessions
    );

  } catch (error) {
    console.error("Failed to load study sessions:", error);
  }
}

let assistantMessages = readStorage("ai_messages", []);

if (!assistantMessages.length) {
  assistantMessages = [{
    sender: "bot",
    message: "Hello! I’m your FocusFlow study assistant. I can help you prioritize tasks, plan focused study sessions, and identify topics that need revision. What would you like to work on today?"
  }];
}

// Start application
document.addEventListener("DOMContentLoaded", async () => {
  document.body.setAttribute("data-theme", state.theme);

  document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric"
    });

  document.getElementById("profileForm").addEventListener("submit", saveProfileChanges);
  document.getElementById("taskForm").addEventListener("submit", saveTask);
  document.getElementById("assistantForm").addEventListener("submit", sendAssistantMessage);

  document.getElementById("assistantInput").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      document.getElementById("assistantForm").requestSubmit();
    }
  });

  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", event => {
      event.preventDefault();
      showSection(item.dataset.target, item);
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeTaskModal();
  });

  // Load tasks before rendering the application.
  // Load tasks and study sessions before rendering.
await loadTasksFromApi();
await loadSessionsFromApi();

syncProfileUI();
renderAll();
initializeCharts();
updateTimerDisplay();
renderAssistantMessages();
initializeAssistant();
});

// Save local application data
function saveAll() {
  localStorage.setItem(userStorageKey("profile"), JSON.stringify(state.profile));
  localStorage.setItem(userStorageKey("tasks"), JSON.stringify(state.tasks));
  localStorage.setItem(userStorageKey("sessions"), JSON.stringify(state.sessions));
  localStorage.setItem(userStorageKey("streak"), String(state.streak));
  localStorage.setItem(userStorageKey("xp"), String(state.xp));
}

function renderAll() {
  renderTasks();
  renderPlanner();
  renderTodayPlan();
  renderAnalytics();
  renderAchievements();
  updateDashboardStats();
  renderSessionHistory();
  updateAssistantSnapshot();
  updateCharts();
}

// Navigation
function showSection(sectionId, navElement) {
  document.querySelectorAll(".content-section").forEach(section => {
    section.classList.add("hidden");
  });

  const target = document.getElementById(sectionId);

  if (!target) return;

  target.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });

  const activeItem = navElement ||
    document.querySelector(`.nav-item[data-target="${sectionId}"]`);

  if (activeItem) activeItem.classList.add("active");

  const title = activeItem
    ? activeItem.querySelector("span").textContent
    : "Dashboard";

  document.getElementById("pageTitle").textContent = title;

  if (sectionId === "analyticsSection") updateCharts();
}

// Profile
function syncProfileUI() {
  const name = state.profile.name || "Student";

  document.getElementById("sidebarUserName").textContent = name;
  document.getElementById("sidebarUserRole").textContent =
    state.profile.department || "Student";

  document.getElementById("welcomeName").textContent = name.split(" ")[0];
  document.getElementById("profileName").value = state.profile.name || "";
  document.getElementById("profileEmail").value = state.profile.email || "";
  document.getElementById("profileDepartment").value =
    state.profile.department || "";

  document.getElementById("profileYear").value =
    state.profile.year || "3rd Year";

  document.getElementById("dailyGoalInput").value =
    state.profile.dailyGoal || 4;

  const avatarName = encodeURIComponent(name);

  document.getElementById("sidebarAvatar").src =
    `https://ui-avatars.com/api/?name=${avatarName}&background=B99A5B&color=fff`;

  document.getElementById("dailyGoalLabel").textContent =
    state.profile.dailyGoal || 4;
}


async function saveProfileChanges(event) {
  event.preventDefault();

  const profileData = {
    name: document.getElementById("profileName").value.trim() || "Student",
    email: document.getElementById("profileEmail").value.trim(),
    department: document.getElementById("profileDepartment").value.trim(),
    academicYear: document.getElementById("profileYear").value,
    studyGoal: Math.max(
      1,
      Math.min(
        16,
        Number(document.getElementById("dailyGoalInput").value) || 4
      )
    )
  };

  try {
    const updated = await apiRequest("/profile", {
      method: "PUT",
      body: JSON.stringify(profileData)
    });

    state.profile.name = updated.name;
    state.profile.email = updated.email;
    state.profile.department = updated.department;
    state.profile.year = updated.academicYear;
    state.profile.dailyGoal = updated.studyGoal;

    saveAll();
    syncProfileUI();
    updateDashboardStats();

    showNotification("Your profile has been updated.");
  } catch (error) {
    console.error("Profile update failed:", error);
    showNotification("Could not save your profile. Please try again.");
  }
}


// Tasks
function openTaskModal() {
  document.getElementById("taskForm").reset();

  document.getElementById("taskDurationInput").value = 45;

  document.getElementById("taskModal").classList.remove("hidden");

  document.getElementById("taskTitleInput").focus();
}

function closeTaskModal() {
  const modal = document.getElementById("taskModal");

  if (modal) modal.classList.add("hidden");
}

// Create task in database

let isSavingTask = false;

// Create task in database
async function saveTask(event) {
  event.preventDefault();

  // Prevent multiple submissions while a task is being saved.
  if (isSavingTask) return;

  isSavingTask = true;

  const form = event.currentTarget;
  const submitButtons = form.querySelectorAll(
    'button[type="submit"], input[type="submit"]'
  );

  submitButtons.forEach(button => {
    button.disabled = true;
  });

  try {
    const task = {
      title: document.getElementById("taskTitleInput").value.trim(),
      subject: document.getElementById("taskSubjectInput").value.trim(),
      priority: document.getElementById("taskPriorityInput").value,
      duration: Number(document.getElementById("taskDurationInput").value) || 45,
      day: document.getElementById("taskDayInput").value,
      deadline: document.getElementById("taskDeadlineInput").value
    };

    if (!task.title || !task.subject) return;

    const savedTask = await apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: task.title,
        subject: task.subject,
        priority: task.priority,
        deadline: task.deadline,
        day: task.day,
        plannedHours: task.duration / 60
      })
    });

    state.tasks.push(taskFromApi(savedTask));

    saveAll();
    closeTaskModal();
    renderAll();

    showNotification("Study task added successfully.");
  } catch (error) {
    console.error("Task creation failed:", error);
    showNotification(error.message || "Could not save task.");
  } finally {
    isSavingTask = false;

    submitButtons.forEach(button => {
      button.disabled = false;
    });
  }
}


// Update task status in database
async function toggleTaskStatus(id, checked) {
  const task = state.tasks.find(item => item.id === id);

  if (!task) return;

  const newStatus = checked ? "completed" : "pending";

  try {
    const updatedTask = await apiRequest(
      `/tasks/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      }
    );

    Object.assign(task, taskFromApi(updatedTask));

    saveAll();
    renderAll();

    showNotification(
      checked
        ? "Task marked as completed."
        : "Task moved back to pending."
    );
  } catch (error) {
    console.error("Task update failed:", error);

    renderTasks();

    showNotification(error.message || "Could not update task.");
  }
}

// Delete task from database
async function deleteTask(id) {
  try {
    await apiRequest(`/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    state.tasks = state.tasks.filter(item => item.id !== id);

    saveAll();
    renderAll();

    showNotification("Task deleted.");
  } catch (error) {
    console.error("Task deletion failed:", error);
    showNotification(error.message || "Could not delete task.");
  }
}

// Update topic rating in database
async function rateTask(id, rating) {
  const task = state.tasks.find(item => item.id === id);

  if (!task) return;

  try {
    const updatedTask = await apiRequest(
      `/tasks/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ rating: Number(rating) })
      }
    );

    Object.assign(task, taskFromApi(updatedTask));

    saveAll();
    renderAnalytics();

    showNotification("Topic rating saved.");
  } catch (error) {
    console.error("Rating update failed:", error);

    renderTasks();

    showNotification(error.message || "Could not save rating.");
  }
}

function filterTasks(filter, button) {
  state.taskFilter = filter;

  document.querySelectorAll(".filter-btn").forEach(item => {
    item.classList.remove("active");
  });

  if (button) button.classList.add("active");

  renderTasks();
}

function renderTasks() {
  const container = document.getElementById("tasksListContainer");

  if (!container) return;

  let tasks = [...state.tasks];

  if (state.taskFilter === "high") {
    tasks = tasks.filter(task => task.priority === "High");
  }

  if (state.taskFilter === "pending") {
    tasks = tasks.filter(task => task.status === "pending");
  }

  if (state.taskFilter === "completed") {
    tasks = tasks.filter(task => task.status === "completed");
  }

  if (!tasks.length) {
    container.innerHTML =
      '<div class="card empty-state">No tasks in this category. Add a study task to get started.</div>';
    return;
  }

  container.innerHTML = tasks.map(task => `
    <article class="task-item">
      <input
        class="task-check"
        type="checkbox"
        aria-label="Mark ${escapeHTML(task.title)} as completed"
        ${task.status === "completed" ? "checked" : ""}
        onchange="toggleTaskStatus('${task.id}',this.checked)"
      >

      <div class="task-main">
        <strong>${escapeHTML(task.title)}</strong>

        <small>
          ${escapeHTML(task.subject)} ·
          ${Number(task.duration) || 0} min ·
          ${task.deadline
            ? `Due ${escapeHTML(task.deadline)}`
            : (dayNames[task.day] || "No day selected")}
        </small>

        <div style="margin-top:7px">
          <span class="priority-badge priority-${task.priority.toLowerCase()}">
            ${task.priority} priority
          </span>

          <span class="status-badge ${task.status === "completed" ? "status-completed" : ""}">
            ${task.status}
          </span>
        </div>
      </div>

      <div class="task-actions">
        <select
          class="small-action"
          aria-label="Rate topic understanding"
          onchange="rateTask('${task.id}',this.value)"
        >
          ${[1, 2, 3, 4, 5].map(value => `
            <option value="${value}" ${Number(task.rating) === value ? "selected" : ""}>
              ${value}/5
            </option>
          `).join("")}
        </select>

        <button
          class="small-action"
          onclick="deleteTask('${task.id}')"
          aria-label="Delete task"
        >
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    </article>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// Weekly planner
function renderPlanner() {
  dayKeys.forEach(day => {
    const container = document.getElementById(`day-${day}`);

    if (!container) return;

    const tasks = state.tasks.filter(task => task.day === day);

    container.innerHTML = tasks.length
      ? tasks.map(task => `
        <div class="planner-task ${task.status === "completed" ? "completed" : ""}">
          <strong>${escapeHTML(task.title)}</strong>
          <small>
            ${escapeHTML(task.subject)} ·
            ${Number(task.duration) || 0} min
          </small>
        </div>
      `).join("")
      : '<p class="empty-state">No topics planned</p>';
  });
}

function renderTodayPlan() {
  const container = document.getElementById("todayPlanList");

  if (!container) return;

  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayKey = dayKeys[todayIndex];

  const tasks = state.tasks.filter(task => task.day === todayKey);

  container.innerHTML = tasks.length
    ? tasks.slice(0, 5).map(task => `
      <div class="plan-row">
        <div>
          <strong>${escapeHTML(task.title)}</strong>
          <small>
            ${escapeHTML(task.subject)} ·
            ${task.status === "completed" ? "Completed" : "Pending"}
          </small>
        </div>
        <span class="plan-duration">${Number(task.duration) || 0} min</span>
      </div>
    `).join("")
    : '<div class="empty-state">No study sessions planned for today. Add a topic in the Study Planner.</div>';
}

// Dashboard calculations
function getTodayFocusMinutes() {
  const today = new Date().toDateString();

  return state.sessions
    .filter(session =>
      new Date(session.completedAt).toDateString() === today &&
      session.mode === "pomodoro"
    )
    .reduce((sum, session) => sum + session.durationMinutes, 0);
}

function updateDashboardStats() {
  const completed = state.tasks.filter(
    task => task.status === "completed"
  ).length;

  const dailyTasks = state.tasks.filter(
    task => task.day === dayKeys[(new Date().getDay() + 6) % 7]
  );

  const dailyCompleted = dailyTasks.filter(
    task => task.status === "completed"
  ).length;

  const dailyScore = dailyTasks.length
    ? Math.round(dailyCompleted / dailyTasks.length * 100)
    : 0;

  const weeklyScore = state.tasks.length
    ? Math.round(completed / state.tasks.length * 100)
    : 0;

  const weekStart = new Date();

  weekStart.setHours(0, 0, 0, 0);

  weekStart.setDate(
    weekStart.getDate() - ((weekStart.getDay() + 6) % 7)
  );

  const weeklyMinutes = state.sessions
    .filter(session =>
      new Date(session.completedAt) >= weekStart &&
      session.mode === "pomodoro"
    )
    .reduce((sum, session) => sum + session.durationMinutes, 0);

  const todayMinutes = getTodayFocusMinutes();
  const todayHours = todayMinutes / 60;
  const goal = Number(state.profile.dailyGoal) || 4;

  document.getElementById("dailyScore").textContent = `${dailyScore}%`;
  document.getElementById("dailyScoreBar").style.width = `${dailyScore}%`;

  document.getElementById("weeklyScore").textContent = `${weeklyScore}%`;
  document.getElementById("weeklyScoreBar").style.width = `${weeklyScore}%`;

  document.getElementById("totalStudyHours").textContent =
    `${(weeklyMinutes / 60).toFixed(1)} hrs`;

  document.getElementById("completedTasksCount").textContent =
    `${completed} / ${state.tasks.length}`;

  document.getElementById("pendingTasksCount").textContent =
    `${state.tasks.length ? Math.round(completed / state.tasks.length * 100) : 0}% completion rate`;

  document.getElementById("todayStudyHours").textContent =
    todayHours.toFixed(1);

  document.getElementById("dailyGoalLabel").textContent = goal;

  document.getElementById("dailyGoalBar").style.width =
    `${Math.min(100, todayHours / goal * 100)}%`;

  document.getElementById("dailyGoalMessage").textContent =
    todayHours >= goal
      ? "Great work! You have reached your daily study goal."
      : ` ${(goal - todayHours).toFixed(1)} hours remaining to reach your daily goal.`;

  document.getElementById("streakCountHeader").textContent = state.streak;
}

// Focus timer
function setTimerMode(mode, minutes, button) {
  pauseTimer();

  if (mode === "pomodoro") {
    minutes = Number(document.getElementById("customStudyMin").value) || minutes;
  }

  if (mode === "shortBreak") {
    minutes = Number(document.getElementById("customBreakMin").value) || minutes;
  }

  state.timer.mode = mode;
  state.timer.totalSeconds = minutes * 60;
  state.timer.remainingSeconds = state.timer.totalSeconds;

  document.querySelectorAll(".mode-btn").forEach(item => {
    item.classList.remove("active");
  });

  if (button) button.classList.add("active");

  document.getElementById("timerStatus").textContent =
    mode === "pomodoro" ? "Ready to focus" : "Time to recharge";

  updateTimerDisplay();
}

function updateTimerSubject() {
  const input = document.getElementById("timerSubjectInput");

  if (input && !input.value.trim()) {
    input.setCustomValidity("Enter a subject or topic.");
  } else if (input) {
    input.setCustomValidity("");
  }
}

function startTimer() {
  if (state.timer.isRunning) return;

  if (state.timer.remainingSeconds <= 0) {
    state.timer.remainingSeconds = state.timer.totalSeconds;
  }

  state.timer.isRunning = true;

  document.getElementById("startTimerBtn").classList.add("hidden");
  document.getElementById("pauseTimerBtn").classList.remove("hidden");

  document.getElementById("timerStatus").textContent = "Focus in progress";

  state.timer.intervalId = setInterval(tickTimer, 1000);
}

function pauseTimer() {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
  }

  state.timer.intervalId = null;
  state.timer.isRunning = false;

  const pauseButton = document.getElementById("pauseTimerBtn");
  const startButton = document.getElementById("startTimerBtn");

  if (pauseButton && startButton) {
    pauseButton.classList.add("hidden");
    startButton.classList.remove("hidden");
  }

  const status = document.getElementById("timerStatus");

  if (status && state.timer.remainingSeconds < state.timer.totalSeconds) {
    status.textContent = "Paused";
  }
}

function tickTimer() {
  if (state.timer.remainingSeconds > 0) {
    state.timer.remainingSeconds -= 1;
    updateTimerDisplay();
  }

  if (state.timer.remainingSeconds <= 0) {
    completeTimerSession();
  }
}

function resetTimer() {
  pauseTimer();

  state.timer.remainingSeconds = state.timer.totalSeconds;

  document.getElementById("timerStatus").textContent = "Ready to focus";

  updateTimerDisplay();
}

function updateTimerDisplay() {
  const minutes = Math.floor(state.timer.remainingSeconds / 60);
  const seconds = state.timer.remainingSeconds % 60;

  document.getElementById("timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const circumference = 848.23;

  const progress = state.timer.totalSeconds
    ? state.timer.remainingSeconds / state.timer.totalSeconds
    : 0;

  document.getElementById("timerProgressRing").style.strokeDashoffset =
    String(circumference * (1 - progress));
}

// Timer session currently uses browser storage.
// Backend session integration will be handled separately.

async function completeTimerSession() {
  pauseTimer();

  const subject =
    document.getElementById("timerSubjectInput").value.trim() ||
    "Study session";

  const durationSeconds = state.timer.totalSeconds;
  const sessionMode = state.timer.mode;

  try {
    if (sessionMode === "pomodoro") {
      const result = await apiRequest("/sessions", {
        method: "POST",
        body: JSON.stringify({
          subject,
          mode: "pomodoro",
          durationSeconds
        })
      });

      state.sessions.unshift({
        ...result.session,
        durationMinutes: Math.round(
          result.session.durationSeconds / 60
        ),
        completedAt: result.session.createdAt
      });

      state.xp = result.xp;

      if (result.level !== undefined) {
        state.level = result.level;
      }

      state.streak = Math.max(1, state.streak);

      localStorage.setItem(userStorageKey("streak"), String(state.streak));
      localStorage.setItem(userStorageKey("xp"), String(state.xp));

      showNotification("Focus session completed! You earned 25 XP.");
    } else {
      showNotification("Break completed. Ready for another focus session?");
    }

    state.timer.remainingSeconds = state.timer.totalSeconds;

    document.getElementById("timerStatus").textContent =
      "Session complete";

    updateTimerDisplay();
    renderAll();
  } catch (error) {
    console.error("Failed to save focus session:", error);

    showNotification(
      "Session could not be saved. Please check your connection and try again."
    );
  }
}


function applyCustomTimer() {
  const focusMinutes =
    Number(document.getElementById("customStudyMin").value);

  const breakMinutes =
    Number(document.getElementById("customBreakMin").value);

  if (
    !Number.isInteger(focusMinutes) ||
    focusMinutes < 1 ||
    focusMinutes > 120 ||
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 1 ||
    breakMinutes > 60
  ) {
    showNotification(
      "Enter a focus time from 1–120 minutes and a break from 1–60 minutes."
    );
    return;
  }

  pauseTimer();

  state.timer.mode = "pomodoro";
  state.timer.totalSeconds = focusMinutes * 60;
  state.timer.remainingSeconds = state.timer.totalSeconds;

  document.querySelectorAll(".mode-btn").forEach(item => {
    item.classList.remove("active");
  });

  document.querySelector('.mode-btn[data-mode="pomodoro"]').classList.add("active");

  document.querySelector('.mode-btn[data-mode="pomodoro"]').textContent =
    `Focus · ${focusMinutes} min`;

  document.querySelector('.mode-btn[data-mode="shortBreak"]').textContent =
    `Short break · ${breakMinutes} min`;

  updateTimerDisplay();

  document.getElementById("timerStatus").textContent = "Custom timer ready";

  showNotification("Your timer settings have been applied.");
}

function renderSessionHistory() {
  const tbody = document.getElementById("timerHistoryTableBody");

  if (!tbody) return;

  tbody.innerHTML = state.sessions.length
    ? state.sessions.slice(0, 10).map(session => `
      <tr>
        <td>${escapeHTML(session.subject)}</td>
        <td>${session.durationMinutes} min</td>
        <td>${new Date(session.completedAt).toLocaleString()}</td>
        <td>${session.mode === "pomodoro" ? "Focus" : "Break"}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="4" class="empty-cell">No completed sessions yet. Complete a focus timer to see your history.</td></tr>';
}

// Analytics
function renderAnalytics() {
  const strong = state.tasks.filter(task => Number(task.rating) >= 4);
  const weak = state.tasks.filter(task => Number(task.rating) <= 2);

  document.getElementById("strongTopicsList").innerHTML =
    strong.length
      ? strong.map(task => `
        <li>
          <span>${escapeHTML(task.title)} <small>(${escapeHTML(task.subject)})</small></span>
          <strong>${task.rating}/5</strong>
        </li>
      `).join("")
      : '<li class="empty-state">No strong topics rated yet.</li>';

  document.getElementById("weakTopicsList").innerHTML =
    weak.length
      ? weak.map(task => `
        <li>
          <span>${escapeHTML(task.title)} <small>(${escapeHTML(task.subject)})</small></span>
          <strong>${task.rating}/5</strong>
        </li>
      `).join("")
      : '<li class="empty-state">No topics need revision right now.</li>';
}

// Achievements
function renderAchievements() {
  const level = Math.floor(state.xp / 1000) + 1;
  const progress = state.xp % 1000 / 10;

  document.getElementById("userLevelDisplay").textContent =
    `Level ${level} Scholar`;

  document.getElementById("userXpDisplay").textContent =
    state.xp % 1000;

  document.getElementById("xpProgressBar").style.width =
    `${progress}%`;

  document.getElementById("currentStreakDisplay").textContent =
    `${state.streak} Days`;

  const badges = [
    {
      title: "First Focus",
      detail: "Complete your first focus session",
      icon: "ri-timer-flash-line",
      unlocked: state.sessions.length >= 1
    },
    {
      title: "Focus Master",
      detail: "Complete 10 focus sessions",
      icon: "ri-flashlight-line",
      unlocked: state.sessions.length >= 10
    },
    {
      title: "7-Day Streak",
      detail: "Study for seven consecutive days",
      icon: "ri-fire-fill",
      unlocked: state.streak >= 7
    },
    {
      title: "Task Champion",
      detail: "Complete five study tasks",
      icon: "ri-medal-line",
      unlocked: state.tasks.filter(task => task.status === "completed").length >= 5
    }
  ];

  document.getElementById("badgesGrid").innerHTML =
    badges.map(badge => `
      <div class="badge-card ${badge.unlocked ? "unlocked" : ""}">
        <i class="${badge.icon}"></i>
        <strong>${badge.title}</strong>
        <small>${badge.detail}</small>
      </div>
    `).join("");
}

// Charts
function initializeCharts() {
  if (typeof Chart === "undefined") {
    document.querySelectorAll(".chart-container").forEach(container => {
      container.innerHTML =
        '<p class="empty-state">Charts need an internet connection to load Chart.js.</p>';
    });
    return;
  }

  const muted =
    getComputedStyle(document.body).getPropertyValue("--muted").trim() ||
    "#71717A";

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: muted,
          usePointStyle: true,
          boxWidth: 8,
          padding: 18
        }
      }
    },
    scales: {
      x: {
        ticks: { color: muted },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { color: muted },
        grid: { color: "rgba(100,116,139,.14)" }
      }
    }
  };

  productivityChart = new Chart(
    document.getElementById("productivityTrendChart"),
    {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Actual hours",
            data: [0, 0, 0, 0, 0, 0, 0],
            borderColor: "#8C735B",
            backgroundColor: "rgba(140,115,91,.10)",
            fill: true,
            tension: .34,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: "#8C735B"
          },
          {
            label: "Target hours",
            data: [4, 4, 4, 4, 4, 4, 4],
            borderColor: "#94A3B8",
            backgroundColor: "transparent",
            borderDash: [5, 5],
            tension: 0,
            borderWidth: 1.8,
            pointRadius: 2,
            pointBackgroundColor: "#94A3B8"
          }
        ]
      },
      options: commonOptions
    }
  );

  subjectChart = new Chart(
    document.getElementById("subjectPerformanceChart"),
    {
      type: "doughnut",
      data: {
        labels: ["No sessions yet"],
        datasets: [{
          data: [1],
          backgroundColor: ["#CBD5E1"],
          borderWidth: 0,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: muted,
              usePointStyle: true,
              boxWidth: 8,
              padding: 15
            }
          }
        }
      }
    }
  );

  plannedActualChart = new Chart(
    document.getElementById("plannedVsActualChart"),
    {
      type: "bar",
      data: {
        labels: ["Planned", "Actual"],
        datasets: [{
          label: "Hours",
          data: [0, 0],
          backgroundColor: [
            "rgba(100,116,139,.72)",
            "rgba(140,115,91,.82)"
          ],
          borderRadius: 7,
          maxBarThickness: 70
        }]
      },
      options: commonOptions
    }
  );

  updateCharts();
}


function updateCharts() {
  if (!productivityChart || !subjectChart || !plannedActualChart) return;

  // 1. Productivity trend: completed task hours by planned weekday
  const completedHoursByDay = Array(7).fill(0);

  state.tasks.forEach(task => {
    if (task.status !== "completed") return;

    const dayIndex = dayKeys.indexOf(task.day);

    if (dayIndex >= 0) {
      completedHoursByDay[dayIndex] += Number(task.duration) || 0;
    }
  });

  productivityChart.data.datasets[0].label = "Completed task hours";
  productivityChart.data.datasets[0].data =
    completedHoursByDay.map(minutes =>
      Number((minutes / 60).toFixed(2))
    );

  productivityChart.data.datasets[1].data =
    Array(7).fill(Number(state.profile.dailyGoal) || 4);

  productivityChart.update();

  // 2. Subject performance: completed tasks per subject
  const subjectTotals = {};

  state.tasks.forEach(task => {
    if (task.status !== "completed") return;

    const subject = task.subject || "General";

    subjectTotals[subject] = (subjectTotals[subject] || 0) + 1;
  });

  const subjects = Object.keys(subjectTotals);

  subjectChart.data.labels =
    subjects.length ? subjects : ["No completed tasks"];

  subjectChart.data.datasets[0].data =
    subjects.length
      ? subjects.map(subject => subjectTotals[subject])
      : [1];

  subjectChart.data.datasets[0].backgroundColor =
    subjects.length
      ? ["#1E293B", "#8C735B", "#64748B", "#CBD5E1", "#A8A29E", "#B9A995"]
      : ["#CBD5E1"];

  subjectChart.data.datasets[0].label = "Completed tasks";
  subjectChart.update();

  // 3. Planned vs completed task hours
  const plannedMinutes = state.tasks.reduce(
    (sum, task) => sum + (Number(task.duration) || 0),
    0
  );

  const completedMinutes = state.tasks
    .filter(task => task.status === "completed")
    .reduce(
      (sum, task) => sum + (Number(task.duration) || 0),
      0
    );

  plannedActualChart.data.datasets[0].data = [
    Number((plannedMinutes / 60).toFixed(1)),
    Number((completedMinutes / 60).toFixed(1))
  ];

  plannedActualChart.data.datasets[0].label = "Task hours";
  plannedActualChart.update();
}


// Theme
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";

  document.body.setAttribute("data-theme", state.theme);

  localStorage.setItem(userStorageKey("theme"), state.theme);

  const icon = document.querySelector("#themeToggleBtn i");

  if (icon) {
    icon.className =
      state.theme === "dark" ? "ri-sun-line" : "ri-moon-line";
  }
}

// CSV export
function exportProductivityReport() {
  const rows = [
    ["Task", "Subject", "Priority", "Status", "Planned Minutes", "Rating"]
  ];

  state.tasks.forEach(task => {
    rows.push([
      task.title,
      task.subject,
      task.priority,
      task.status,
      task.duration,
      task.rating
    ]);
  });

  rows.push([]);

  rows.push([
    "Focus Session Subject",
    "Duration Minutes",
    "Mode",
    "Completed At"
  ]);

  state.sessions.forEach(session => {
    rows.push([
      session.subject,
      session.durationMinutes,
      session.mode,
      session.completedAt
    ]);
  });

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "FocusFlow_Productivity_Report.csv";

  link.click();

  URL.revokeObjectURL(url);

  showNotification("Your CSV report has been downloaded.");
}

// Reset sample data
function resetSampleData() {
  if (!window.confirm(
    "Reset tasks, sessions and progress to the sample data?"
  )) return;

  state.tasks = DEFAULT_TASKS.map(task => ({ ...task }));
  state.sessions = [];
  state.xp = 0;
  state.streak = 5;

  saveAll();
  renderAll();

  showNotification("Sample data has been restored.");
}

// Notifications
function showNotification(message) {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

// AI study assistant
async function initializeAssistant() {
  renderAssistantMessages();

  try {
    const history = await apiRequest("/ai/history");

    if (Array.isArray(history) && history.length) {
      assistantMessages = history.map(item => ({
        sender: item.sender === "user" ? "user" : "bot",
        message: item.message || ""
      }));

      saveAssistantMessages();
      renderAssistantMessages();
    }

    setAssistantConnection(true, "Backend connected");
  } catch (error) {
    console.error("AI history request failed:", error);
    setAssistantConnection(false, "Local demo mode");
  }
}

function setAssistantConnection(connected, label) {
  const pill = document.getElementById("assistantConnectionPill");
  const text = document.getElementById("assistantConnectionText");

  if (!pill || !text) return;

  pill.classList.toggle("connected", connected);
  text.textContent = label;
}

function saveAssistantMessages() {
  try {
    localStorage.setItem(
      userStorageKey("ai_messages"),
      JSON.stringify(assistantMessages.slice(-50))
    );
  } catch (error) {
    // Chat remains available for the current browser session.
  }
}

function renderAssistantMessages() {
  const container = document.getElementById("chatMessages");

  if (!container) return;

  container.innerHTML = assistantMessages.slice(-50).map(item => {
    const isUser = item.sender === "user";

    const safeMessage = escapeHTML(item.message || "")
      .replace(/\n/g, "<br>");

    return `
      <div class="chat-message ${isUser ? "user-message" : "assistant-message"}">
        <div class="message-avatar">
          <i class="${isUser ? "ri-user-line" : "ri-sparkling-2-fill"}"></i>
        </div>
        <div class="message-bubble">${safeMessage}</div>
      </div>
    `;
  }).join("");

  container.scrollTop = container.scrollHeight;
}

function updateAssistantSnapshot() {
  const pending = state.tasks.filter(
    task => task.status !== "completed"
  );

  const completed = state.tasks.filter(
    task => task.status === "completed"
  );

  const weak = state.tasks.filter(
    task => Number(task.rating) <= 2 &&
      task.status !== "completed"
  );

  const todayHours = getTodayFocusMinutes() / 60;

  const values = {
    assistantPendingCount: pending.length,
    assistantWeakCount: weak.length,
    assistantFocusHours: `${todayHours.toFixed(1)}h`,
    assistantCompletedCount: completed.length
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) element.textContent = value;
  });

  const nextTitle = document.getElementById("assistantNextTitle");
  const nextText = document.getElementById("assistantNextText");

  if (!nextTitle || !nextText) return;

  const priorityOrder = {
    High: 0,
    Medium: 1,
    Low: 2
  };

  const recommended = weak[0] ||
    [...pending].sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) -
        (priorityOrder[b.priority] ?? 3)
    )[0];

  if (recommended) {
    nextTitle.textContent = weak.length
      ? `Revise ${recommended.title}`
      : `Start ${recommended.title}`;

    nextText.textContent =
      `${recommended.subject} · ${recommended.duration || 25} minutes. ` +
      (weak.length
        ? "Your confidence rating suggests this topic needs another review."
        : `${recommended.priority} priority — a good next task to complete.`);
  } else {
    nextTitle.textContent = "Your task list is clear";

    nextText.textContent =
      "Add your next topic or study goal to get a fresh recommendation.";
  }
}

function localAssistantReply(message) {
  const pending = state.tasks.filter(
    task => task.status !== "completed"
  );

  const weak = pending.filter(
    task => Number(task.rating) <= 2
  );

  const priorityOrder = {
    High: 0,
    Medium: 1,
    Low: 2
  };

  const nextTask = weak[0] ||
    [...pending].sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) -
        (priorityOrder[b.priority] ?? 3)
    )[0];

  const prompt = message.toLowerCase();

  if (/explain|teach|definition|what is|solve|question/.test(prompt)) {
    return "I’m currently in local demo mode, so I can use your saved tasks and study ratings to help you plan, but I can’t generate full subject explanations yet. Start your FocusFlow backend with a Gemini API key to enable the connected AI study coach.";
  }

  if (nextTask && weak.length) {
    return `Your self-rating shows that “${nextTask.title}” in ${nextTask.subject} needs more attention. I recommend a ${Math.min(25, Number(nextTask.duration) || 25)}-minute revision session first. After the session, update its confidence rating and then move to your next pending task.`;
  }

  if (nextTask) {
    return `You have ${pending.length} pending task${pending.length === 1 ? "" : "s"}. Start with “${nextTask.title}” in ${nextTask.subject} (${nextTask.priority.toLowerCase()} priority). Try one 25-minute focus block, take a short break, and mark the task complete when you finish.`;
  }

  return "Your current task list is clear. Add your next subject or topic in My Tasks, then I can help you decide how to organize your study time. A short, consistent focus session is a good way to begin.";
}

async function sendAssistantMessage(event) {
  event.preventDefault();

  const input = document.getElementById("assistantInput");
  const sendButton = document.getElementById("assistantSendBtn");

  const message = input.value.trim();

  if (!message) return;

  assistantMessages.push({
    sender: "user",
    message
  });

  saveAssistantMessages();
  renderAssistantMessages();

  input.value = "";
  sendButton.disabled = true;
  sendButton.innerHTML = '<i class="ri-loader-4-line"></i>';

  try {
    const data = await apiRequest("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message })
    });

    if (!data.reply) {
      throw new Error("No assistant reply was returned.");
    }

    assistantMessages.push({
      sender: "bot",
      message: data.reply
    });

    setAssistantConnection(true, "Backend connected");
  } catch (error) {
    console.error("AI chat request failed:", error);

    assistantMessages.push({
      sender: "bot",
      message: localAssistantReply(message)
    });

    setAssistantConnection(false, "Local demo mode");
  } finally {
    saveAssistantMessages();
    renderAssistantMessages();

    sendButton.disabled = false;
    sendButton.innerHTML = '<i class="ri-send-plane-2-fill"></i>';

    input.focus();
  }
}

function useAssistantPrompt(prompt) {
  const input = document.getElementById("assistantInput");
  const form = document.getElementById("assistantForm");

  if (!input || !form) return;

  input.value = prompt;
  form.requestSubmit();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('authToken');
  localStorage.removeItem('loggedInUser');

  window.location.href = 'login.html';
}