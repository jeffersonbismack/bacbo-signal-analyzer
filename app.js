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

function count(result, source = history) {
  return source.filter(item => item === result).length;
}

function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function getStreak(source = history) {
  if (!source.length) return { result: null, size: 0 };

  const last = source[source.length - 1];
  let size = 0;

  for (let i = source.length - 1; i >= 0 && source[i] === last; i--) {
    size++;
  }

  return { result: last, size };
}

function getRecent(limit = 12) {
  return history.slice(-limit);
}

function getAlternationScore(source) {
  if (source.length < 2) return 0;

  let changes = 0;
  let comparisons = 0;

  for (let i = 1; i < source.length; i++) {
    if (source[i] === "T" || source[i - 1] === "T") continue;
    comparisons++;
    if (source[i] !== source[i - 1]) changes++;
  }

  return comparisons ? Math.round((changes / comparisons) * 100) : 0;
}

function getPatternStats(source) {
  const pairs = {
    PP: 0, PB: 0, BP: 0, BB: 0,
    PT: 0, BT: 0, TP: 0, TB: 0, TT: 0
  };

  for (let i = 1; i < source.length; i++) {
    const key = source[i - 1] + source[i];
    if (Object.prototype.hasOwnProperty.call(pairs, key)) pairs[key]++;
  }

  return pairs;
}

function getSignalEngine() {
  const recent = getRecent(12);

  if (recent.length < 8) {
    return {
      status: "AGUARDANDO",
      title: "Dados insuficientes",
      confidence: 0,
      result: null,
      reason: "Registre pelo menos 8 rodadas para ativar o motor estatístico."
    };
  }

  const windows = [
    { name: "curta", data: recent.slice(-6), weight: 1.5 },
    { name: "media", data: recent.slice(-10), weight: 1 },
    { name: "recente", data: recent, weight: 1.2 }
  ];

  const scores = { P: 0, B: 0, T: 0 };

  windows.forEach(window => {
    const total = window.data.length;
    ["P", "B", "T"].forEach(result => {
      const frequency = count(result, window.data) / total;
      scores[result] += frequency * window.weight;
    });
  });

  const recentCounts = {
    P: count("P", recent),
    B: count("B", recent),
    T: count("T", recent)
  };

  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topResult, topScore] = ordered[0];
  const [, secondScore] = ordered[1];

  const gap = topScore - secondScore;
  const streak = getStreak();
  const alternation = getAlternationScore(recent);

  let points = 0;
  const reasons = [];

  if (gap >= 0.14) {
    points += 2;
    reasons.push("diferença de frequência entre as principais opções");
  } else if (gap >= 0.07) {
    points += 1;
    reasons.push("pequena vantagem estatística recente");
  }

  if (recentCounts[topResult] >= Math.ceil(recent.length * 0.5)) {
    points += 1;
    reasons.push("frequência acima de 50% na janela recente");
  }

  if (streak.size >= 2 && streak.result === topResult) {
    points += 1;
    reasons.push("continuidade da sequência atual");
  }

  if (alternation >= 60 && streak.size === 1 && (topResult === "P" || topResult === "B")) {
    points += 1;
    reasons.push("histórico recente com alta alternância");
  }

  // Empate só recebe destaque quando há evidência descritiva real.
  // Não usamos atraso do empate como justificativa.
  if (topResult === "T" && recentCounts.T < 2) {
    points = Math.max(0, points - 1);
  }

  const confidence = Math.min(85, 45 + points * 8);
  const status = points >= 3 ? "FORTE" : points >= 2 ? "MODERADO" : "FRACO";

  return {
    status,
    title: points >= 2 ? `Tendência: ${labels[topResult]}` : "Sem tendência dominante",
    confidence: points >= 2 ? confidence : 0,
    result: points >= 2 ? topResult : null,
    reason: points >= 2
      ? `Baseada em ${reasons.join(", ")}. É uma leitura do histórico, não uma previsão garantida.`
      : "As diferenças entre os resultados ainda não são fortes o suficiente para destacar uma tendência."
  };
}

function buildAnalysis() {
  if (history.length < 5) {
    return "Cadastre pelo menos 5 rodadas para gerar uma leitura estatística básica.";
  }

  const recent = getRecent(12);
  const recentCounts = {
    P: count("P", recent),
    B: count("B", recent),
    T: count("T", recent)
  };

  const ordered = Object.entries(recentCounts).sort((a, b) => b[1] - a[1]);
  const [topResult, topCount] = ordered[0];
  const [secondResult, secondCount] = ordered[1];
  const streak = getStreak();
  const alternation = getAlternationScore(recent);

  const parts = [
    `Nas últimas ${recent.length} rodadas, ${labels[topResult]} apareceu ${topCount} vez(es).`,
    `${labels[secondResult]} apareceu ${secondCount} vez(es).`
  ];

  if (streak.size >= 3) {
    parts.push(`Há uma sequência atual de ${streak.size} em ${labels[streak.result]}.`);
  } else {
    parts.push(`Alternância recente: ${alternation}% entre Player e Banker, desconsiderando empates.`);
  }

  parts.push("A leitura descreve o histórico observado e não garante o próximo resultado.");

  return parts.join(" ");
}

function renderSignal() {
  const engine = getSignalEngine();
  const signalEl = document.querySelector("#analysis");

  if (!signalEl) return;

  if (engine.result) {
    signalEl.innerHTML = `
      <div class="signal-head">
        <div>
          <span class="signal-label">SINAL ESTATÍSTICO</span>
          <strong class="signal-result ${engine.result}">${engine.title}</strong>
        </div>
        <span class="signal-confidence">${engine.confidence}%</span>
      </div>
      <div class="signal-meter"><span style="width:${engine.confidence}%"></span></div>
      <p>${engine.reason}</p>
      <small>Status do motor: ${engine.status}</small>
    `;
  } else {
    signalEl.innerHTML = `
      <div class="signal-head">
        <div>
          <span class="signal-label">SINAL ESTATÍSTICO</span>
          <strong class="signal-result neutral">${engine.title}</strong>
        </div>
        <span class="signal-confidence">—</span>
      </div>
      <p>${engine.reason}</p>
      <small>Motor em modo de observação.</small>
    `;
  }
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
      .map(item => `<span class="history-item ${item}" title="${labels[item]}">${item}</span>`)
      .join("");
  }

  const streak = getStreak();
  const streakEl = document.querySelector("#streak");
  streakEl.textContent = streak.size
    ? `Sequência: ${streak.size} ${labels[streak.result]}`
    : "Sem sequência";

  renderSignal();
}

document.querySelectorAll("[data-result]").forEach(button => {
  button.addEventListener("click", () => addResult(button.dataset.result));
});

document.querySelector("#resetBtn").addEventListener("click", resetHistory);

render();
