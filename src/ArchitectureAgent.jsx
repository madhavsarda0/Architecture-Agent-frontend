import { useState, useRef, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════
// MODELS — every AI "brain" this app can use, what it's good at, and which
// key (password) it needs. "Free" models cost nothing to use.
// ════════════════════════════════════════════════════════════════════════
const MODELS = {
  or_claude_haiku: {
    name: "Claude Haiku",
    provider: "openrouter",
    apiModel: "anthropic/claude-3.5-haiku",
    cost: "Free",
    blurb: "Careful, well-organized answers",
    specialty: ["general", "code"],
    color: "#D97757", bg: "#FFF4EE", border: "#FDDBB4",
  },
  gemini_flash: {
    name: "Gemini 2.5 Flash",
    provider: "google",
    apiModel: "gemini-2.5-flash",
    cost: "Free",
    blurb: "Quick, broad, good all-rounder",
    specialty: ["general", "fast"],
    color: "#1A73E8", bg: "#EEF4FF", border: "#C2D7FF",
  },
  gemini_pro: {
    name: "Gemini 3.1 Pro",
    provider: "google",
    apiModel: "gemini-2.5-pro-preview-06-05",
    cost: "Paid",
    blurb: "Deep research, remembers huge amounts of text",
    specialty: ["research", "longdoc", "business"],
    color: "#0B57D0", bg: "#E8F0FE", border: "#AECBFA",
  },
  groq_llama: {
    name: "Llama 3.3 70B",
    provider: "groq",
    apiModel: "llama-3.3-70b-versatile",
    cost: "Free",
    blurb: "The fastest reply of all the models",
    specialty: ["fast", "general"],
    color: "#F97316", bg: "#FFF7ED", border: "#FED7AA",
  },
  groq_mixtral: {
    name: "Mixtral 8x7B",
    provider: "groq",
    apiModel: "mixtral-8x7b-32768",
    cost: "Free",
    blurb: "More imaginative, creative ideas",
    specialty: ["creative"],
    color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA",
  },
  mistral_codestral: {
    name: "Codestral",
    provider: "mistral",
    apiModel: "codestral-latest",
    cost: "Free",
    blurb: "Specializes in technical & code-heavy detail",
    specialty: ["code"],
    color: "#FF7000", bg: "#FFF4EC", border: "#FFD0A8",
  },
  deepseek_r1: {
    name: "DeepSeek R1",
    provider: "openrouter",
    apiModel: "deepseek/deepseek-r1:free",
    cost: "Free",
    blurb: "Best at slow, careful step-by-step thinking",
    specialty: ["reasoning"],
    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE",
  },
  qwen3: {
    name: "Qwen 3 235B",
    provider: "openrouter",
    apiModel: "qwen/qwen3-235b-a22b:free",
    cost: "Free",
    blurb: "Very broad general knowledge & reasoning",
    specialty: ["reasoning", "longdoc"],
    color: "#9333EA", bg: "#FAF5FF", border: "#E9D5FF",
  },
  deepseek_v3: {
    name: "DeepSeek V3",
    provider: "openrouter",
    apiModel: "deepseek/deepseek-chat:free",
    cost: "Free",
    blurb: "Fast, dependable, good for business ideas",
    specialty: ["business", "fast", "general"],
    color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE",
  },
  perplexity_sonar: {
    name: "Perplexity Sonar",
    provider: "perplexity",
    apiModel: "sonar",
    cost: "Paid (optional)",
    blurb: "Looks things up live on the internet first",
    specialty: ["research"],
    color: "#1FB8CD", bg: "#ECFEFF", border: "#A5F3FC",
  },
};

const PROVIDERS = [
  { key: "google", label: "Google AI Studio", note: "Needed for the two Gemini models", help: "aistudio.google.com" },
  { key: "groq", label: "Groq", note: "Needed for Llama & Mixtral (free, very fast)", help: "console.groq.com" },
  { key: "openrouter", label: "OpenRouter", note: "Needed for Claude Haiku, DeepSeek & Qwen", help: "openrouter.ai" },
  { key: "mistral", label: "Mistral", note: "Needed for Codestral (code specialist)", help: "console.mistral.ai" },
  { key: "perplexity", label: "Perplexity", note: "Optional — only for live web-search answers", help: "perplexity.ai", optional: true },
];

// ── How a project description is matched to the right 4 models ────────────
const KEYWORD_GROUPS = {
  code: { words: ["code", "app", "software", "api", "database", "algorithm", "program", "developer", "technical", "backend", "frontend", "platform", "automat", "build a"], boost: ["mistral_codestral", "or_claude_haiku", "deepseek_r1"], label: "Sounds technical / code-heavy" },
  creative: { words: ["creative", "story", "content", "design", "brand", "marketing", "game", "art", "writing", "social media"], boost: ["groq_mixtral", "or_claude_haiku"], label: "Sounds creative" },
  research: { words: ["market", "research", "competitor", "industry", "trend", "current", "news", "statistic", "study", "compare", "live data"], boost: ["perplexity_sonar", "gemini_pro"], label: "Needs research / current info" },
  longdoc: { words: ["document", "report", "contract", "book", "large amount", "huge amount", "pdf", "legal", "lots of data"], boost: ["gemini_pro", "qwen3"], label: "Involves a lot of information" },
  business: { words: ["startup", "business", "revenue", "monetiz", "investor", "saas", "company", "pricing", "customers", "subscription"], boost: ["gemini_pro", "deepseek_v3"], label: "Business / startup focused" },
  reasoning: { words: ["risk", "security", "complex", "logic", "plan", "strategy", "decision", "optimi", "safety", "edge case"], boost: ["deepseek_r1", "qwen3"], label: "Needs careful step-by-step thinking" },
  fast: { words: ["quick", "fast", "simple", "mvp", "prototype", "small", "basic"], boost: ["groq_llama", "gemini_flash"], label: "Sounds simple / wants a fast answer" },
};

function computeScores(text, winCounts) {
  const t = text.toLowerCase();
  const scores = {};
  Object.keys(MODELS).forEach((k) => { scores[k] = 1; }); // everyone starts with a small base chance
  Object.values(KEYWORD_GROUPS).forEach((group) => {
    const hits = group.words.filter((w) => t.includes(w)).length;
    if (hits > 0) group.boost.forEach((k) => { scores[k] = (scores[k] || 0) + hits * 3; });
  });
  Object.entries(winCounts || {}).forEach(([k, count]) => {
    if (scores[k] !== undefined) scores[k] += Math.min(count, 5) * 1.5;
  });
  return scores;
}

function matchedGroupsFor(modelKey, text) {
  const t = text.toLowerCase();
  return Object.values(KEYWORD_GROUPS).filter((g) => g.boost.includes(modelKey) && g.words.some((w) => t.includes(w)));
}

function autoSelect(text, winCounts, hasPerplexityKey) {
  const scores = computeScores(text, winCounts);
  let entries = Object.entries(scores);
  if (!hasPerplexityKey) entries = entries.filter(([k]) => k !== "perplexity_sonar");
  entries.sort((a, b) => b[1] - a[1]);
  const top4 = entries.slice(0, 4).map(([k]) => k);
  const rest = entries.slice(4).map(([k]) => k);
  return { top4, rest };
}

// ════════════════════════════════════════════════════════════════════════
// PROMPT — forces every model into the same 12-section, beginner-launch-focused shape
// ════════════════════════════════════════════════════════════════════════
function buildPrompt(projectDescription, extraContext) {
  return `You are talking to someone with ZERO coding, business, or technical background. They have an idea for a product or service and a gut feeling it could work — but no idea how to actually build or launch it. Your job is to be the knowledgeable friend who tells them exactly what to do, in an order they can follow, so they could realistically start taking action today. Follow these rules without exception:

- Use short sentences. Use everyday words.
- Every single time you use a technical, business, or finance word, explain it immediately afterward in plain English inside square brackets. Example: "API [a way for two computer programs to send each other information]". Do this every time, even for words that seem obvious to you.
- Never assume the reader knows what ANY tool, platform, or term means. If you name a specific tool or service, briefly say in one phrase what it's for.
- Keep the same depth of real information you'd give a technical or business reader — just say it in simple words. Do not water down the substance, only the language.
- Write like you are guiding them to actually do this, not just describing it from a distance. Prefer concrete specifics ("start with X, then do Y") over vague advice ("research your options").
- Use the EXACT 12 section headers below, in this EXACT order, each on its own line starting with "## " then the number, a period, then the title in capital letters. Do not add, remove, merge, or reorder sections.

PROJECT DESCRIPTION:
${projectDescription}
${extraContext ? `\nADDITIONAL CONTEXT:\n${extraContext}\n` : ""}

Now write the full answer using exactly this structure:

## 1. MAIN QUESTION
Restate, in one or two plain sentences, the main problem or need this idea addresses.

## 2. SUMMARY
A short plain-English summary of the whole idea (4-6 sentences) — what it is and who it's for.

## 3. WHAT YOU'RE ACTUALLY BUILDING
Describe, in plain words first, all the main pieces of this product or service and how they fit together. Only after the plain-English explanation, add a simple ASCII diagram (a picture made only of text characters like boxes and arrows) showing those pieces, inside a code block using three backtick characters before and after it.

## 4. HOW IT WORKS, STEP BY STEP
Explain, numbered, exactly what happens from the moment a customer/user shows up to the moment they get value from it.

## 5. REAL-WORLD EXAMPLES
Give three versions of a worked example using exactly these subheadings:
### SIMPLE
A very basic example a total beginner would follow easily.
### MEDIUM
A realistic, everyday example with a bit more detail.
### COMPLEX
An advanced, real-world example with more moving parts.

## 6. YOUR LAUNCH PLAN
This is the most important section. Give a concrete, numbered, step-by-step plan for actually launching this idea, written for someone starting from zero. Cover, in order: what to do first (week 1), what to set up or build next, what to test before spending real money, and how to get the first real users or customers. Name specific types of tools or platforms a beginner could realistically use at each step (with a one-phrase explanation of what each does), not just generic advice like "build a website."

## 7. WHAT YOU'LL NEED & WHAT IT COSTS
List the tools, skills, people, or services needed to build and run this for the first year, paired with a low-end and high-end dollar estimate, and a plain-English time estimate for getting a first working version live, with a one-line reason why.

## 8. WHO WILL USE THIS & HOW MANY
A realistic plain-English estimate of who would use this, roughly how many people might adopt it and over what time period, and roughly what percent of the relevant audience this could realistically reach, with a one-line reason for that number.

## 9. WILL THIS MAKE MONEY
A plain-English, stage-by-stage estimate of when money put into this might start coming back (ROI [return on investment, meaning the money you earn back compared to what you spent]).

## 10. WHAT MAKES YOURS DIFFERENT
Plain-English explanation of what could make this idea stand out from similar things that already exist.

## 11. WHAT COULD GO WRONG
A clear bullet list of the downsides, risks, or weak points of this idea — and for each one, a one-line note on how someone could plan around it or reduce it.

## 12. GLOSSARY
A short glossary. List every technical, business, or finance word you used above as a bullet, each with a one-line plain-English meaning. This is the last section — a reference list, not something they need to read first.`;
}

// ════════════════════════════════════════════════════════════════════════
// API CALLERS — one shared function per "shape" of API
// ════════════════════════════════════════════════════════════════════════
const PROVIDER_LABELS = { google: "Google AI Studio", groq: "Groq", openrouter: "OpenRouter", mistral: "Mistral", perplexity: "Perplexity" };

// ════════════════════════════════════════════════════════════════════════
// BACKEND CALL — the browser never sees any provider API key. All requests
// go to our own server (warpsync.in backend), which holds the real keys
// and proxies to Google / Groq / OpenRouter / Mistral / Perplexity.
// ════════════════════════════════════════════════════════════════════════

// Set this to your deployed backend's URL once it's live, e.g.
// "https://api.warpsync.in". Left blank, the app falls back to local mock
// responses so the UI is still previewable before the backend is deployed.
const BACKEND_URL = "https://architecture-agent-eham.onrender.com";

function getClientId() {
  try {
    let id = window.localStorage?.getItem("aa-client-id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage?.setItem("aa-client-id", id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

function mockResponse(modelKey, prompt) {
  const m = MODELS[modelKey];
  const descMatch = /PROJECT DESCRIPTION:\n([\s\S]*?)\n/.exec(prompt);
  const desc = (descMatch?.[1] || "your idea").trim().slice(0, 80);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`## 1. MAIN QUESTION
This is a [PREVIEW] mock answer from ${m.name}, shown because no backend URL is configured yet. The real question would restate: "${desc}".

## 2. SUMMARY
${m.name} (${m.blurb.toLowerCase()}) would normally summarize the idea here in four to six plain sentences. This is placeholder text so you can see the layout working end-to-end before your backend is live.

## 3. WHAT YOU'RE ACTUALLY BUILDING
The system would have a few main parts that pass information to each other.
\`\`\`
[User] --> [App] --> [Database [where information is stored]]
\`\`\`

## 4. HOW IT WORKS, STEP BY STEP
1. The user does something that starts the process.
2. The system processes it through the core logic.
3. The system returns a result to the user.

## 5. REAL-WORLD EXAMPLES
### SIMPLE
A basic walkthrough would appear here.
### MEDIUM
A more detailed, realistic walkthrough would appear here.
### COMPLEX
An advanced, multi-step walkthrough would appear here.

## 6. YOUR LAUNCH PLAN
1. Week 1: validate the idea — talk to a few potential users before building anything.
2. Set up the simplest possible version using a no-code tool [a tool that lets you build something without writing programming code].
3. Test it with a small group before spending real money on it.
4. Get your first real users through a low-cost channel like word of mouth or a simple social post.

## 7. WHAT YOU'LL NEED & WHAT IT COSTS
You'd need a few basic tools and maybe a freelancer for the technical pieces. Low end: $2,000. High end: $20,000, depending on features. A first working version would realistically take 4-8 weeks.

## 8. WHO WILL USE THIS & HOW MANY
A few hundred early users within the first 3 months is a realistic start, reaching roughly 5-10% of the relevant audience early on.

## 9. WILL THIS MAKE MONEY
Early traction in months 1-3, break-even somewhere in months 6-12, depending on costs.

## 10. WHAT MAKES YOURS DIFFERENT
Focusing on one clear use case better than competitors would help this stand out.

## 11. WHAT COULD GO WRONG
- Preview data only — connect your backend for a true answer. (Fix: deploy the backend.)
- Limited detail in preview mode. (Fix: this resolves automatically once a real model responds.)

## 12. GLOSSARY
- API [a way for two computer programs to send each other information]
- No-code tool [a tool that lets you build something without writing programming code]
- Preview [a stand-in response shown because the backend isn't connected yet]`);
    }, 900 + Math.random() * 1400);
  });
}

async function callModel(modelKey, prompt, projectDesc) {
  if (!BACKEND_URL) return mockResponse(modelKey, prompt);

  const response = await fetch(`${BACKEND_URL}/api/run-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelKey, prompt, projectDesc, clientId: getClientId() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data.text || "No response received.";
}

// ════════════════════════════════════════════════════════════════════════
// PARSING — splits one model's raw answer into the 12 labeled sections
// ════════════════════════════════════════════════════════════════════════
const SECTION_DEFS = [
  { num: "1", title: "Main Question", icon: "❓" },
  { num: "2", title: "Summary", icon: "📝" },
  { num: "3", title: "What You're Actually Building", icon: "🏗️" },
  { num: "4", title: "How It Works, Step by Step", icon: "🔁" },
  { num: "5", title: "Real-World Examples", icon: "💡" },
  { num: "6", title: "Your Launch Plan", icon: "🚀" },
  { num: "7", title: "What You'll Need & What It Costs", icon: "💰" },
  { num: "8", title: "Who Will Use This & How Many", icon: "📈" },
  { num: "9", title: "Will This Make Money", icon: "📅" },
  { num: "10", title: "What Makes Yours Different", icon: "✨" },
  { num: "11", title: "What Could Go Wrong", icon: "⚠️" },
  { num: "12", title: "Glossary", icon: "📚" },
];

function parseSections(text) {
  const re = /^##\s*(\d{1,2})\.\s*([^\n]+)$/gm;
  const idxs = [];
  let m;
  while ((m = re.exec(text))) idxs.push({ num: m[1], start: m.index, len: m[0].length });
  const sections = {};
  idxs.forEach((idx, i) => {
    const start = idx.start + idx.len;
    const end = i + 1 < idxs.length ? idxs[i + 1].start : text.length;
    sections[idx.num] = text.slice(start, end).trim();
  });
  return sections;
}

function parseExamples(content) {
  const re = /^###\s*(SIMPLE|MEDIUM|COMPLEX)\s*$/gim;
  const idxs = [];
  let m;
  while ((m = re.exec(content))) idxs.push({ level: m[1].toUpperCase(), start: m.index, len: m[0].length });
  const out = { SIMPLE: "", MEDIUM: "", COMPLEX: "" };
  idxs.forEach((idx, i) => {
    const start = idx.start + idx.len;
    const end = i + 1 < idxs.length ? idxs[i + 1].start : content.length;
    out[idx.level] = content.slice(start, end).trim();
  });
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// TEXT RENDERER — turns plain text / bullets / code fences into styled JSX
// ════════════════════════════════════════════════════════════════════════
function renderLine(line, key) {
  if (line.startsWith("- ") || line.startsWith("* "))
    return <div key={key} style={{ display: "flex", gap: 8, margin: "3px 0", paddingLeft: 4 }}><span style={{ color: "#94A3B8", marginTop: 1 }}>•</span><span style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.7 }}>{line.slice(2)}</span></div>;
  if (/^\d+\.\s/.test(line))
    return <div key={key} style={{ display: "flex", gap: 8, margin: "3px 0", paddingLeft: 4 }}><span style={{ color: "#94A3B8", fontSize: 13.5, minWidth: 18 }}>{line.match(/^\d+/)[0]}.</span><span style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.7 }}>{line.replace(/^\d+\.\s/, "")}</span></div>;
  if (line.startsWith("**") && line.endsWith("**") && line.length > 3)
    return <p key={key} style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B", margin: "8px 0 2px" }}>{line.slice(2, -2)}</p>;
  if (line.trim() === "") return <div key={key} style={{ height: 6 }} />;
  return <p key={key} style={{ fontSize: 13.5, color: "#334155", margin: "3px 0", lineHeight: 1.75 }}>{line}</p>;
}

function renderContent(text) {
  if (!text) return <p style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic" }}>Nothing here.</p>;
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith("```")) {
      let j = i + 1;
      const buf = [];
      while (j < lines.length && !lines[j].trim().startsWith("```")) { buf.push(lines[j]); j++; }
      blocks.push({ type: "code", content: buf.join("\n") });
      i = j + 1;
    } else {
      blocks.push({ type: "line", content: lines[i] });
      i++;
    }
  }
  return blocks.map((b, idx) =>
    b.type === "code" ? (
      <pre key={idx} style={{ background: "#0F172A", color: "#D1FAE5", padding: 14, borderRadius: 10, fontSize: 11.5, lineHeight: 1.65, overflowX: "auto", fontFamily: "'SF Mono', Menlo, Consolas, monospace", margin: "10px 0", whiteSpace: "pre" }}>{b.content}</pre>
    ) : renderLine(b.content, idx)
  );
}

// ════════════════════════════════════════════════════════════════════════
// SMALL UI PIECES
// ════════════════════════════════════════════════════════════════════════
const FEEDBACK_TAGS = ["Easy to understand", "Most detailed", "Most accurate", "Too vague", "Too technical"];

function StarRating({ value = 0, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange(n === value ? 0 : n)}
          style={{ cursor: "pointer", fontSize: 20, color: n <= value ? "#F59E0B" : "#E2E8F0", lineHeight: 1, userSelect: "none" }}
        >★</span>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════
export default function ArchitectureAgent() {
  const [projectDesc, setProjectDesc] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);

  const [hasRun, setHasRun] = useState(false);
  const [runModels, setRunModels] = useState([]);
  const [outputs, setOutputs] = useState({});
  const [ratings, setRatings] = useState({});
  const [tags, setTags] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [exampleLevel, setExampleLevel] = useState({});
  const [winCounts, setWinCounts] = useState({});
  const [history, setHistory] = useState([]);
  const outputRef = useRef(null);

  // Which providers have a key configured on the SERVER. The browser only
  // ever learns true/false per provider — never the key itself.
  const [providerStatus, setProviderStatus] = useState({ google: true, groq: true, openrouter: true, mistral: true, perplexity: true });

  // Load remembered preference (which model has won before) + provider availability
  useEffect(() => {
    try {
      const saved = localStorage.getItem("model-win-counts");
      if (saved) setWinCounts(JSON.parse(saved));
    } catch (e) { /* nothing saved yet — that's fine */ }
    (async () => {
      try {
        if (BACKEND_URL) {
          const r = await fetch(`${BACKEND_URL}/api/provider-status`);
          if (r.ok) setProviderStatus(await r.json());
        }
      } catch (e) { /* backend not reachable yet — assume all available for preview */ }
    })();
  }, []);

  const persistWin = (modelKey) => {
    try {
      let counts = {};
      try {
        const saved = localStorage.getItem("model-win-counts");
        if (saved) counts = JSON.parse(saved);
      } catch (e) { /* first time */ }
      counts[modelKey] = (counts[modelKey] || 0) + 1;
      localStorage.setItem("model-win-counts", JSON.stringify(counts));
      setWinCounts(counts);
    } catch (e) { /* storage unavailable — ignore quietly */ }
  };

  const combinedText = `${projectDesc} ${extraContext}`;
  const selection = autoSelect(combinedText, winCounts, providerStatus.perplexity !== false);
  const previewReady = projectDesc.trim().length > 8;
  const winnerKeyOverall = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const getWinner = (r) => {
    let max = 0, winner = null;
    Object.entries(r).forEach(([k, v]) => { if (v > max) { max = v; winner = k; } });
    return max > 0 ? winner : null;
  };

  const handleRate = (modelKey, stars) => {
    setRatings((prev) => {
      const next = { ...prev, [modelKey]: stars };
      const winner = getWinner(next);
      if (winner) persistWin(winner);
      return next;
    });
  };

  const toggleTag = (modelKey, tag) => {
    setTags((prev) => {
      const current = prev[modelKey] || [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [modelKey]: next };
    });
  };

  const handleRun = () => {
    if (!projectDesc.trim()) return;
    const models = selection.top4;
    setRunModels(models);
    setHasRun(true);
    setRatings({});
    setTags({});
    setExampleLevel({});
    setActiveTab(models[0]);
    const startState = {};
    models.forEach((m) => { startState[m] = { status: "loading" }; });
    setOutputs(startState);

    const prompt = buildPrompt(projectDesc, extraContext);
    models.forEach((modelKey) => {
      callModel(modelKey, prompt, projectDesc)
        .then((text) => {
          setOutputs((prev) => ({ ...prev, [modelKey]: { status: "done", text } }));
          setHistory((h) => {
            const entry = { desc: projectDesc.slice(0, 60) + (projectDesc.length > 60 ? "…" : ""), models, time: Date.now() };
            return [entry, ...h.filter((x) => x.time !== entry.time)].slice(0, 4);
          });
        })
        .catch((e) => setOutputs((prev) => ({ ...prev, [modelKey]: { status: "error", error: e.message } })));
    });
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
  };

  const winnerTab = getWinner(ratings);
  const activeOutput = activeTab ? outputs[activeTab] : null;
  const activeModelInfo = activeTab ? MODELS[activeTab] : null;
  const sections = activeOutput?.status === "done" ? parseSections(activeOutput.text) : null;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#F8FAFC", minHeight: "100vh", padding: "0 0 60px" }}>

      {/* ── HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)", padding: "28px 24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(29,105,245,0.12)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(217,119,87,0.1)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: "#94A3B8", marginBottom: 6 }}>10-MODEL AUTO-PICK</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#FFFFFF", margin: "0 0 6px", lineHeight: 1.2 }}>Architecture Agent</h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>Describe your idea once. We pick the best 4 AI models for it, run them side by side, and explain everything in plain English.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ background: "#22C55E", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, letterSpacing: 0.5 }}>8 FREE MODELS</span>
            <span style={{ background: "#1A73E8", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, letterSpacing: 0.5 }}>2 PAID (OPTIONAL)</span>
            <span style={{ background: "#334155", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, letterSpacing: 0.5 }}>NO TECH KNOWLEDGE NEEDED</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* ── PROVIDER STATUS (read-only — keys live on the server only) */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>🔒 Model Access</span>
          </div>
          <p style={{ fontSize: 11.5, color: "#94A3B8", margin: "4px 0 10px" }}>
            API keys [passwords that connect to each AI company] are stored only on the server, never in this browser. Nobody using this tool can see or copy them.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PROVIDERS.map((p) => {
              const available = providerStatus[p.key] !== false;
              return (
                <span
                  key={p.key}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20,
                    fontSize: 11, fontWeight: 600, background: available ? "#F0FDF4" : "#F8FAFC",
                    color: available ? "#15803D" : "#94A3B8", border: `1px solid ${available ? "#BBF7D0" : "#E2E8F0"}`,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: available ? "#22C55E" : "#CBD5E1" }} />
                  {p.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── PROJECT DESCRIPTION INPUTS */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: 1, marginBottom: 10 }}>DESCRIBE YOUR IDEA</div>
          <textarea
            placeholder="Describe your project or idea in plain words… (e.g. 'I want an app that helps restaurants track how much food they have left, and warns them before they run out')"
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            rows={4}
            style={{ width: "100%", border: "1.5px solid #CBD5E1", borderRadius: 12, padding: "12px 14px", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6, color: "#1E293B" }}
          />
          <textarea
            placeholder="Optional: budget, team size, timeline, or anything else that matters…"
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            rows={2}
            style={{ width: "100%", border: "1.5px solid #CBD5E1", borderRadius: 12, padding: "12px 14px", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6, color: "#1E293B", marginTop: 8 }}
          />
        </div>

        {/* ── AUTO-SELECTED MODELS PREVIEW + EXPLANATION */}
        {previewReady && (
          <div style={{ marginTop: 16, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: 1, marginBottom: 10 }}>WE PICKED THESE 4 MODELS FOR YOU</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {selection.top4.map((mk) => {
                const m = MODELS[mk];
                const groups = matchedGroupsFor(mk, combinedText);
                return (
                  <div key={mk} style={{ border: `1.5px solid ${m.border}`, background: m.bg, borderRadius: 12, padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: m.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.name}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#64748B" }}>{m.cost} · {m.blurb}</div>
                    {mk === winnerKeyOverall && winCounts[mk] && (
                      <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 3, fontWeight: 600 }}>🏆 Your usual favorite</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div onClick={() => setWhyOpen((v) => !v)} style={{ marginTop: 10, fontSize: 12, color: "#1A73E8", fontWeight: 600, cursor: "pointer" }}>
              {whyOpen ? "Hide explanation ▲" : "Why these 4? And what would the others do differently? ▼"}
            </div>

            {whyOpen && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>WHY WE PICKED THEM</div>
                {selection.top4.map((mk) => {
                  const m = MODELS[mk];
                  const groups = matchedGroupsFor(mk, combinedText);
                  const reason = groups.length ? groups.map((g) => g.label).join(" · ") : "A strong, reliable all-purpose choice for any project.";
                  return (
                    <div key={mk} style={{ fontSize: 11.5, color: "#475569", margin: "4px 0" }}>
                      <span style={{ fontWeight: 700, color: m.color }}>{m.name}:</span> {reason}
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", margin: "12px 0 6px" }}>OTHER MODELS NOT USED THIS TIME</div>
                {selection.rest.map((mk) => {
                  const m = MODELS[mk];
                  return (
                    <div key={mk} style={{ fontSize: 11.5, color: "#94A3B8", margin: "4px 0" }}>
                      <span style={{ fontWeight: 600, color: "#64748B" }}>{m.name}:</span> would have leaned on — {m.blurb.toLowerCase()}.
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── RUN BUTTON */}
        <button
          onClick={handleRun}
          disabled={!projectDesc.trim()}
          style={{
            width: "100%", marginTop: 14, padding: "14px",
            background: !projectDesc.trim() ? "#CBD5E1" : "linear-gradient(135deg, #1A73E8, #0F172A)",
            color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: !projectDesc.trim() ? "not-allowed" : "pointer", transition: "all 0.2s",
          }}
        >
          ⚡ Run All 4 Models
        </button>

        {/* ── OUTPUT */}
        {hasRun && (
          <div ref={outputRef} style={{ marginTop: 20 }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {runModels.map((mk) => {
                const m = MODELS[mk];
                const st = outputs[mk]?.status;
                const isActive = activeTab === mk;
                const isWinner = winnerTab === mk;
                return (
                  <button
                    key={mk}
                    onClick={() => setActiveTab(mk)}
                    style={{
                      flex: "0 0 auto", padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${isActive ? m.color : "#E2E8F0"}`,
                      background: isActive ? m.bg : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: st === "loading" ? "#F59E0B" : st === "error" ? "#EF4444" : m.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? m.color : "#475569" }}>{m.name}</span>
                    {isWinner && <span style={{ fontSize: 12 }}>🏆</span>}
                  </button>
                );
              })}
            </div>

            {/* Active tab content */}
            {activeOutput && (
              <div style={{ marginTop: 10, background: "#fff", border: `1.5px solid ${activeModelInfo.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ background: activeModelInfo.bg, padding: "12px 16px", borderBottom: `1px solid ${activeModelInfo.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: activeModelInfo.color, letterSpacing: 0.5 }}>{activeModelInfo.name.toUpperCase()} {winnerTab === activeTab && "· 🏆 WINNER"}</div>
                    <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{activeModelInfo.cost} · {activeModelInfo.blurb}</div>
                  </div>
                  {activeOutput.status === "done" && (
                    <button onClick={() => navigator.clipboard?.writeText(activeOutput.text)} style={{ fontSize: 11, padding: "5px 10px", border: `1px solid ${activeModelInfo.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", color: "#64748B" }}>Copy</button>
                  )}
                </div>

                <div style={{ padding: 16 }}>
                  {activeOutput.status === "loading" && (
                    <div style={{ fontSize: 13, color: "#94A3B8", padding: "30px 0", textAlign: "center" }}>⏳ Thinking… this can take up to a minute.</div>
                  )}
                  {activeOutput.status === "error" && (
                    <div style={{ background: "#FFF1F1", border: "1px solid #FECACA", borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", marginBottom: 4 }}>⚠️ Couldn't get an answer</div>
                      <div style={{ fontSize: 12, color: "#7F1D1D" }}>{activeOutput.error}</div>
                    </div>
                  )}
                  {activeOutput.status === "done" && sections && (
                    <div>
                      {SECTION_DEFS.map((def) => {
                        const content = sections[def.num] || "";
                        if (def.num === "4") {
                          const ex = parseExamples(content);
                          const level = exampleLevel[activeTab] || "SIMPLE";
                          return (
                            <div key={def.num} style={{ marginBottom: 18 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                                <span style={{ fontSize: 15 }}>{def.icon}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{def.num}. {def.title}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                {["SIMPLE", "MEDIUM", "COMPLEX"].map((lvl) => (
                                  <button
                                    key={lvl}
                                    onClick={() => setExampleLevel((p) => ({ ...p, [activeTab]: lvl }))}
                                    style={{
                                      padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                      background: level === lvl ? activeModelInfo.color : "#fff",
                                      color: level === lvl ? "#fff" : activeModelInfo.color,
                                      border: `1.5px solid ${activeModelInfo.color}`,
                                    }}
                                  >{lvl.charAt(0) + lvl.slice(1).toLowerCase()}</button>
                                ))}
                              </div>
                              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12 }}>{renderContent(ex[level])}</div>
                            </div>
                          );
                        }
                        return (
                          <div key={def.num} style={{ marginBottom: 18 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #F1F5F9" }}>
                              <span style={{ fontSize: 15 }}>{def.icon}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{def.num}. {def.title}</span>
                            </div>
                            {renderContent(content)}
                          </div>
                        );
                      })}

                      {/* ── RATING + FEEDBACK */}
                      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8 }}>RATE THIS ANSWER</div>
                        <StarRating value={ratings[activeTab] || 0} onChange={(v) => handleRate(activeTab, v)} />
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", margin: "14px 0 8px" }}>WHAT DESCRIBES IT BEST?</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {FEEDBACK_TAGS.map((tag) => {
                            const selected = (tags[activeTab] || []).includes(tag);
                            return (
                              <button
                                key={tag}
                                onClick={() => toggleTag(activeTab, tag)}
                                style={{
                                  padding: "6px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                                  background: selected ? "#0F172A" : "#fff", color: selected ? "#fff" : "#475569",
                                  border: "1.5px solid " + (selected ? "#0F172A" : "#CBD5E1"),
                                }}
                              >{tag}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MODEL REFERENCE GUIDE */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: 1, marginBottom: 10 }}>ALL 10 MODELS THIS APP CAN USE</div>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {Object.entries(MODELS).map(([key, m], i) => (
              <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", borderBottom: i < Object.keys(MODELS).length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{m.blurb} · via {PROVIDER_LABELS[m.provider]}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: m.cost.startsWith("Free") ? "#22C55E" : "#F59E0B", flexShrink: 0 }}>{m.cost.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── HISTORY */}
        {history.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: 1, marginBottom: 10 }}>RECENT PROJECTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} onClick={() => setProjectDesc(h.desc.replace(/…$/, ""))} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 16 }}>🗂️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{h.desc}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{h.models.map((mk) => MODELS[mk].name).join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADMIN PANEL (passphrase-gated search log) */}
        <AdminPanel />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ADMIN PANEL — collapsed by default. Enter the passphrase you set as
// ADMIN_PASSPHRASE on the server to see every search anyone has run: who
// (an anonymous per-browser client id, not a name), what they typed, when,
// and which models were used. This is a UI gate, not real security — the
// passphrase travels to your server in a request header, so only use this
// over HTTPS, and don't rely on it as your only protection if the log ever
// contains anything sensitive.
// ════════════════════════════════════════════════════════════════════════
function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [log, setLog] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLog = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/log`, {
        headers: { "x-admin-passphrase": passphrase },
      });
      if (r.status === 401) {
        setError("Wrong passphrase.");
        setUnlocked(false);
      } else if (!r.ok) {
        setError("Couldn't load the log.");
      } else {
        const data = await r.json();
        setLog(data.entries);
        setUnlocked(true);
      }
    } catch (e) {
      setError(BACKEND_URL ? "Couldn't reach the server." : "Backend not configured yet — admin log isn't available in preview mode.");
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px dashed #E2E8F0" }}>
      <div onClick={() => setOpen((v) => !v)} style={{ fontSize: 11, color: "#CBD5E1", cursor: "pointer", userSelect: "none" }}>
        {open ? "▲ admin" : "▾ admin"}
      </div>
      {open && (
        <div style={{ marginTop: 10, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14 }}>
          {!unlocked ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>Admin passphrase</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchLog()}
                  placeholder="Enter passphrase…"
                  style={{ flex: 1, border: "1px solid #CBD5E1", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, outline: "none" }}
                />
                <button onClick={fetchLog} disabled={loading || !passphrase} style={{ padding: "8px 14px", background: "#0F172A", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {loading ? "…" : "Unlock"}
                </button>
              </div>
              {error && <div style={{ fontSize: 11.5, color: "#EF4444", marginTop: 6 }}>{error}</div>}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>Search log ({log?.length || 0})</span>
                <button onClick={() => { setUnlocked(false); setPassphrase(""); setLog(null); }} style={{ fontSize: 11, color: "#64748B", background: "none", border: "none", cursor: "pointer" }}>Lock</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                {(log || []).map((e, i) => (
                  <div key={i} style={{ fontSize: 11, padding: "8px 10px", background: e.status === "error" ? "#FFF1F1" : "#F8FAFC", borderRadius: 8 }}>
                    <div style={{ color: "#94A3B8" }}>{new Date(e.time).toLocaleString()} · {MODELS[e.modelKey]?.name || e.modelKey} · {e.status}</div>
                    <div style={{ color: "#334155", marginTop: 2 }}>{e.projectDesc || "(no description)"}</div>
                  </div>
                ))}
                {(!log || log.length === 0) && <div style={{ fontSize: 12, color: "#94A3B8" }}>No searches logged yet.</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
