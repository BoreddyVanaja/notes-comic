// Notes-2-Comic frontend logic
// Talks to the backend at /api/generate-comic and /api/generate-quiz
// (same origin, since the backend serves this file too).
console.log("app.js loaded");
const API_BASE = ""; // same origin

const state = {
  notes: "",
  comicPanels: [],
  mindMap: null,
  questions: [],
  answers: [],
  lastScorePct: 0,
};

// ---------- Safe element getter (logs instead of silently breaking everything) ----------
function $(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`[app.js] Missing element with id="${id}" — check your HTML.`);
  }
  return el;
}

// ---------- View switching ----------
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = $(id);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Home / input ----------
const notesInput = $("notesInput");
const fileInput = $("fileInput");
const inputError = $("inputError");

if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    notesInput.value = text.slice(0, 6000);
  });
}

const transformBtn = $("transformBtn");
if (transformBtn) {
  transformBtn.addEventListener("click", async () => {
    console.log("[app.js] Transform button clicked");

    const notes = notesInput.value.trim();
    inputError.textContent = "";

    if (!notes) {
      inputError.textContent = "Please paste or type some notes first.";
      return;
    }
    if (notes.length < 20) {
      inputError.textContent = "Add a bit more detail so the AI has something to work with.";
      return;
    }

    state.notes = notes;
    const panelCount = $("panelCount").value;
    const questionCount = $("questionCount").value;

    showView("view-loading");
    $("loadingText").textContent = "Turning your notes into a story...";

    try {
      console.log("[app.js] Sending requests to backend...");

      const [comicRes, quizRes] = await Promise.all([
        fetch(`${API_BASE}/api/generate-comic`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, panelCount }),
        }),
        fetch(`${API_BASE}/api/generate-quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, questionCount }),
        }),
      ]);

      console.log("[app.js] Comic response status:", comicRes.status);
      console.log("[app.js] Quiz response status:", quizRes.status);

      // Guard against non-JSON responses (e.g. Render's cold-start HTML page,
      // or any proxy/error page that isn't actual API JSON)
      const comicCT = comicRes.headers.get("content-type") || "";
      const quizCT = quizRes.headers.get("content-type") || "";

      if (!comicCT.includes("application/json") || !quizCT.includes("application/json")) {
        throw new Error(
          "The server is still waking up (this can happen after inactivity). Please wait a few seconds and try again."
        );
      }

      const comicData = await comicRes.json();
      const quizData = await quizRes.json();

      console.log("[app.js] Comic data:", comicData);
      console.log("[app.js] Quiz data:", quizData);

      if (!comicRes.ok) throw new Error(comicData.error || "Comic generation failed.");
      if (!quizRes.ok) throw new Error(quizData.error || "Quiz generation failed.");

      if (!comicData.panels || !Array.isArray(comicData.panels) || comicData.panels.length === 0) {
        throw new Error("Comic generation failed — no panels returned.");
      }
      if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
        throw new Error("Quiz generation failed — no questions returned.");
      }

      state.comicPanels = comicData.panels;
      state.mindMap = quizData.mindMap || null;
      state.questions = quizData.questions;
      state.answers = new Array(quizData.questions.length).fill(null);

      renderComic();
      console.log("[app.js] Comic rendered successfully");

      showView("view-comic");
    } catch (err) {
      console.error("[app.js] Error during transform:", err);
      showView("view-home");
      inputError.textContent = "Something went wrong: " + err.message;
    }
  });
} else {
  console.error("[app.js] transformBtn not found — button clicks will never fire!");
}

// ---------- Comic rendering ----------
function renderComic() {
  const strip = $("comicStrip");
  strip.innerHTML = "";
  state.comicPanels.forEach((panel, i) => {
    const div = document.createElement("div");
    div.className = "comic-panel";
    div.innerHTML = `
      <img src="${panel.imageBase64}" alt="Comic panel ${i + 1}" />
      <div class="caption"><span class="panel-num">#${i + 1}</span> ${escapeHtml(panel.caption)}</div>
    `;
    strip.appendChild(div);
  });
}

$("backToHomeFromComic")?.addEventListener("click", () => showView("view-home"));
$("goToQuizBtn")?.addEventListener("click", () => {
  renderQuiz();
  showView("view-quiz");
});

// ---------- Quiz rendering ----------
function renderQuiz() {
  const container = $("quizContainer");
  container.innerHTML = "";
  state.answers = new Array(state.questions.length).fill(null);

  state.questions.forEach((q, qIdx) => {
    const qDiv = document.createElement("div");
    qDiv.className = "quiz-question";
    qDiv.innerHTML = `<div class="q-title">${qIdx + 1}. ${escapeHtml(q.question)}</div>`;

    const optsDiv = document.createElement("div");
    optsDiv.className = "quiz-options";

    q.options.forEach((opt, oIdx) => {
      const label = document.createElement("label");
      label.className = "quiz-option";
      label.innerHTML = `
        <input type="radio" name="q${qIdx}" value="${oIdx}" />
        <span>${escapeHtml(opt)}</span>
      `;
      label.addEventListener("click", () => {
        state.answers[qIdx] = oIdx;
        optsDiv.querySelectorAll(".quiz-option").forEach((el) => el.classList.remove("selected"));
        label.classList.add("selected");
      });
      optsDiv.appendChild(label);
    });

    qDiv.appendChild(optsDiv);
    container.appendChild(qDiv);
  });
}

$("submitQuizBtn")?.addEventListener("click", () => {
  const unanswered = state.answers.filter((a) => a === null).length;
  if (unanswered > 0) {
    alert(`Please answer all questions. ${unanswered} left.`);
    return;
  }

  let correct = 0;
  state.questions.forEach((q, i) => {
    if (state.answers[i] === q.correctIndex) correct++;
  });
  const pct = Math.round((correct / state.questions.length) * 100);
  state.lastScorePct = pct;

  saveHistoryEntry(pct);
  renderResults(pct);
  showView("view-results");
});

// ---------- Results ----------
function renderResults(pct) {
  const card = $("resultsCard");
  const pass = pct >= 60;
  card.classList.toggle("pass", pass);
  card.classList.toggle("fail", !pass);

  $("resultsEmoji").textContent = pass ? "🎉" : "💪";
  $("resultsHeadline").textContent = pass ? "Congratulations!" : "Keep Learning!";
  $("scoreText").textContent = pct + "%";
  $("resultsMessage").textContent = pass
    ? "You're a learning superstar! Keep up the amazing work!"
    : "Not quite there yet, but that's okay! Every challenge is an opportunity to grow — let's review together.";
}

$("retryQuizBtn")?.addEventListener("click", () => {
  renderQuiz();
  showView("view-quiz");
});
$("backToHomeFromResults")?.addEventListener("click", () => showView("view-home"));
$("reviewMindMapBtn")?.addEventListener("click", () => {
  renderMindMap();
  showView("view-mindmap");
});

// ---------- Mind map ----------
function renderMindMap() {
  const container = $("mindMapContainer");
  container.innerHTML = "";
  if (!state.mindMap) return;

  const topic = document.createElement("div");
  topic.className = "mindmap-topic";
  topic.textContent = state.mindMap.mainTopic;
  container.appendChild(topic);

  const branches = document.createElement("div");
  branches.className = "mindmap-branches";
  state.mindMap.keyConcepts.forEach((concept) => {
    const c = document.createElement("div");
    c.className = "mindmap-concept";
    c.innerHTML = `<div class="concept-title">${escapeHtml(concept.title)}</div>`;
    concept.details.forEach((d) => {
      const detail = document.createElement("div");
      detail.className = "concept-detail";
      detail.textContent = d;
      c.appendChild(detail);
    });
    branches.appendChild(c);
  });
  container.appendChild(branches);
}

$("backToResultsBtn")?.addEventListener("click", () => showView("view-results"));
$("retryFromMindMapBtn")?.addEventListener("click", () => {
  renderQuiz();
  showView("view-quiz");
});

// ---------- Progress history (stored locally in the browser) ----------
function saveHistoryEntry(pct) {
  const history = JSON.parse(localStorage.getItem("n2c_history") || "[]");
  history.unshift({
    date: new Date().toISOString(),
    topic: (state.mindMap && state.mindMap.mainTopic) || "Untitled notes",
    score: pct,
  });
  localStorage.setItem("n2c_history", JSON.stringify(history.slice(0, 50)));
}

function renderHistory() {
  const container = $("historyContainer");
  const history = JSON.parse(localStorage.getItem("n2c_history") || "[]");
  container.innerHTML = "";

  if (history.length === 0) {
    container.innerHTML = `<div class="history-empty">No quizzes taken yet — transform some notes to get started!</div>`;
    return;
  }

  history.forEach((h) => {
    const div = document.createElement("div");
    div.className = "history-item";
    const date = new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    div.innerHTML = `
      <div><strong>${escapeHtml(h.topic)}</strong><br/><span style="color:#5b5e78;font-size:0.85rem">${date}</span></div>
      <div style="font-weight:700;color:${h.score >= 60 ? "#4caf7d" : "#e8543a"}">${h.score}%</div>
    `;
    container.appendChild(div);
  });
}

$("navHistoryBtn")?.addEventListener("click", () => {
  renderHistory();
  showView("view-history");
});
$("backToHomeFromHistory")?.addEventListener("click", () => showView("view-home"));

// ---------- Utils ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
