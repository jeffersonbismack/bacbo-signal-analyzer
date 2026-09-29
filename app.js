const STORAGE_KEY = "bacbo-signal-history-v1";

const labels = {
  P: "PLAYER",
  B: "BANKER",
  T: "EMPATE"
};

let history = loadHistory();

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter(item => ["P", "B", "T"].includes(item)) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function addResult(result) {
  history.push(result);
  saveHistory();
  render();
}

function resetHistory() {
  if (!history.length) return;
  if (confirm("Deseja realmente limpar todo o histórico?")) {
    history = [];
    saveHistory();
    render();
  }
}

function count(result) {
  return history.filter(item => item === result).length;
}

function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function getStreak() {
  if (!history.length) return { result: null, size: 0 };

  const last = history[history.length - 1];
  let size = 0;

  for (let i = history.length - 1; i >= 0 && history[i] === last; i--) {
    size++;
  }

  return { result: last, size };
}

function getRecent(limit = 12) {
  return history.slice(-limit);
}

function buildAnalysis() {
  if (history.length < 5) {
    return "Cadastre pelo menos 5 rodadas para gerar uma leitura estatística básica.";
  }

  const recent = getRecent(12);
  const recentCounts = {
    P: recent.filter(x => x === "P").length,
    B: recent.filter(x => x === "B").length,
    T: recent.filter(x => x === "T").length
  };

  const ordered = Object.entries(recentCounts).sort((a, b) => b[1] - a[1]);
  const [topResult, topCount] = ordered[0];
  const [secondResult, secondCount] = ordered[1];

  const streak = getStreak();
  const parts = [
    `Nas últimas ${recent.length} rodadas, ${labels[topResult]} apareceu ${topCount} vez(es).`,
    `${labels[secondResult]} apareceu ${secondCount} vez(es).`
  ];

  if (streak.size >= 3) {
    parts.push(`Há uma sequência atual de ${streak.size} em ${labels[streak.result]}.`);
  } else {
    parts.push("Não há uma sequência longa no resultado atual.");
  }

  parts.push("Isso descreve o histórico observado; não significa que o próximo resultado seguirá a mesma tendência.");

  return parts.join(" ");
}

function render() {
  const total = history.length;
  const player = count("P");
  const banker = count("B");
  const tie = count("T");

  document.querySelector("#totalCount").textContent = total;
  document.querySelector("#playerCount").textContent = player;
  document.querySelector("#bankerCount").textContent = banker;
  document.querySelector("#tieCount").textContent = tie;

  document.querySelector("#playerPct").textContent = `${percentage(player, total)}%`;
  document.querySelector("#bankerPct").textContent = `${percentage(banker, total)}%`;
  document.querySelector("#tiePct").textContent = `${percentage(tie, total)}%`;

  const last = history[history.length - 1];
  document.querySelector("#lastResult").textContent = last ? labels[last] : "—";

  const historyEl = document.querySelector("#history");

  if (!history.length) {
    historyEl.className = "history empty";
    historyEl.textContent = "Nenhum resultado registrado.";
  } else {
    historyEl.className = "history";
    historyEl.innerHTML = history
      .slice(-40)
      .map((item, index) => `<span class="history-item ${item}" title="${labels[item]}">${item}</span>`)
      .join("");
  }

  const streak = getStreak();
  const streakEl = document.querySelector("#streak");
  streakEl.textContent = streak.size
    ? `Sequência: ${streak.size} ${labels[streak.result]}`
    : "Sem sequência";

  document.querySelector("#analysis").textContent = buildAnalysis();
}

document.querySelectorAll("[data-result]").forEach(button => {
  button.addEventListener("click", () => addResult(button.dataset.result));
});

document.querySelector("#resetBtn").addEventListener("click", resetHistory);

render();
