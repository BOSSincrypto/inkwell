import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import katex from "katex";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";
import LZString from "lz-string";
import {
  Bold, Italic, Strikethrough, Code, Link as LinkIcon, Image as ImageIcon,
  List, ListOrdered, Quote, Heading1, Heading2, Heading3, CheckSquare,
  Table as TableIcon, Minus, Download, Upload, FileDown, Sun, Moon,
  Eye, EyeOff, Columns2, FileText, Copy, Trash2, Save, Search, Menu,
  Undo2, Redo2, Printer, Sparkles, Replace, X, ChevronUp, ChevronDown,
  Focus, Target, Check, Share2, Command, BookTemplate,
  Keyboard, History, RotateCcw,
} from "lucide-react";

mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });

// Sanitize mermaid-generated SVG before injecting via innerHTML. Documents can
// be loaded from untrusted sources (Share via URL), so treat diagram output as
// untrusted markup.
function sanitizeSvg(svg: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
  });
}

// Emoji shortcodes
const EMOJI_MAP: Record<string, string> = {
  smile: "😀", laughing: "😂", heart: "❤️", fire: "🔥", rocket: "🚀",
  star: "⭐", check: "✅", cross: "❌", warning: "⚠️", bulb: "💡",
  tada: "🎉", thumbsup: "👍", thumbsdown: "👎", eyes: "👀", wave: "👋",
  pray: "🙏", clap: "👏", zap: "⚡", sparkles: "✨", bug: "🐛",
  book: "📖", pencil: "✏️", pin: "📌", clock: "⏰", calendar: "📅",
  chart: "📊", link: "🔗", lock: "🔒", key: "🔑", mag: "🔍",
};

// Templates
const TEMPLATES: { name: string; icon: string; content: string }[] = [
  { name: "Meeting Notes", icon: "📝", content: `# Meeting Notes — ${new Date().toLocaleDateString()}\n\n**Attendees:** \n**Date:** ${new Date().toLocaleDateString()}\n\n## Agenda\n\n1. \n2. \n3. \n\n## Discussion\n\n\n## Action Items\n\n- [ ] \n- [ ] \n\n## Next Steps\n\n` },
  { name: "Blog Post", icon: "✍️", content: `# Title Goes Here\n\n> A compelling subtitle or excerpt.\n\n*Published on ${new Date().toLocaleDateString()}*\n\n## Introduction\n\nStart with a hook that grabs the reader's attention.\n\n## Main Point 1\n\n\n## Main Point 2\n\n\n## Conclusion\n\nWrap up with a memorable takeaway.\n` },
  { name: "README", icon: "📦", content: `# Project Name\n\n> One-line description of what this project does.\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Installation\n\n\`\`\`bash\nnpm install my-project\n\`\`\`\n\n## Usage\n\n\`\`\`typescript\nimport { thing } from 'my-project';\nthing();\n\`\`\`\n\n## License\n\nMIT\n` },
  { name: "Daily Journal", icon: "📔", content: `# ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n## 🌅 Morning\n\nHow I'm feeling: \n\nTop 3 priorities today:\n1. \n2. \n3. \n\n## 📝 Notes\n\n\n## 🌙 Evening Reflection\n\nWhat went well: \n\nWhat could improve: \n\nGratitude: \n` },
  { name: "Technical Spec", icon: "🔧", content: `# Technical Design: [Feature Name]\n\n**Author:** \n**Status:** Draft\n**Date:** ${new Date().toLocaleDateString()}\n\n## Overview\n\nBrief description of what we're building and why.\n\n## Goals\n\n- \n- \n\n## Non-Goals\n\n- \n\n## Proposed Solution\n\n### Architecture\n\n\`\`\`mermaid\nflowchart LR\n  A[Client] --> B[API]\n  B --> C[(Database)]\n\`\`\`\n\n### API\n\n\`\`\`typescript\ninterface Example {\n  id: string;\n}\n\`\`\`\n\n## Alternatives Considered\n\n\n## Open Questions\n\n- [ ] \n` },
  { name: "Math Notes", icon: "📐", content: `# Math Notes\n\n## Inline math\n\nEuler's identity: $e^{i\\pi} + 1 = 0$\n\n## Block math\n\n$$\n\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}\n$$\n\n$$\n\\frac{\\partial}{\\partial t}\\Psi = -\\frac{i}{\\hbar}\\hat{H}\\Psi\n$$\n` },
  { name: "Mermaid Diagram", icon: "🗺️", content: `# Diagrams\n\n\`\`\`mermaid\nflowchart TD\n  A[Start] --> B{Decision?}\n  B -->|Yes| C[Action A]\n  B -->|No| D[Action B]\n  C --> E[End]\n  D --> E\n\`\`\`\n\n\`\`\`mermaid\nsequenceDiagram\n  Alice->>Bob: Hello!\n  Bob-->>Alice: Hi there\n\`\`\`\n` },
];

// -------- marked config --------
const renderer = new marked.Renderer();
marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});
marked.use({
  renderer: {
    code(this: any, { text, lang }: { text: string; lang?: string }) {
      // Keep mermaid blocks as-is so the mermaid renderer can pick them up.
      if (lang === "mermaid") {
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<pre><code class="language-mermaid">${escaped}</code></pre>`;
      }
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    },
  },
});

// Task list rendering
const originalListitem = renderer.listitem?.bind(renderer);
marked.use({
  renderer: {
    listitem(this: any, item: any) {
      if (item.task) {
        const checked = item.checked ? "checked" : "";
        const text = this.parser.parseInline(item.tokens);
        return `<li class="task-list-item"><input type="checkbox" ${checked} disabled> ${text}</li>`;
      }
      return `<li>${this.parser.parse(item.tokens)}</li>`;
    },
  },
});

const STORAGE_KEY = "inkwell-md-content";
const THEME_KEY = "inkwell-theme";
const VIEW_KEY = "inkwell-view";
const GOAL_KEY = "inkwell-goal";
const FOCUS_KEY = "inkwell-focus";
const SNAPSHOTS_KEY = "inkwell-snapshots";
const SCROLLSYNC_KEY = "inkwell-scrollsync";

interface Snapshot { id: string; name: string; content: string; createdAt: number; }

const SAMPLE = `# Welcome to Inkwell

A refined markdown editor built for writers, engineers, and thinkers.

## Features

- **Live preview** with GFM support
- **Syntax highlighting** for code blocks
- **Import & export** — .md, .html, .pdf (print)
- **Task lists**, tables, footnotes
- **Autosave** to local storage
- **Outline navigation** — click any heading

## Try it

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Task list

- [x] Ship the editor
- [x] Add preview
- [ ] Take over the world

### Table

| Feature | Status |
|---------|--------|
| Import  |   ✓    |
| Export  |   ✓    |
| PDF     |   ✓    |

> "Simplicity is the ultimate sophistication."

---

Start writing above. Everything you type is saved automatically.
`;

type ViewMode = "split" | "editor" | "preview";

interface Heading {
  level: number;
  text: string;
  id: string;
  line: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractHeadings(md: string): Heading[] {
  const lines = md.split("\n");
  const headings: Heading[] = [];
  let inCode = false;
  lines.forEach((line, idx) => {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      return;
    }
    if (inCode) return;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const text = m[2].trim();
      headings.push({
        level: m[1].length,
        text,
        id: slugify(text),
        line: idx,
      });
    }
  });
  return headings;
}

function stats(md: string) {
  const words = md.trim() ? md.trim().split(/\s+/).length : 0;
  const chars = md.length;
  const lines = md.split("\n").length;
  const readMin = Math.max(1, Math.round(words / 220));
  return { words, chars, lines, readMin };
}

export default function MarkdownEditor() {
  // SSR-safe defaults. Real values are loaded from localStorage / URL hash
  // in a mount effect below to avoid hydration mismatches.
  const [content, setContent] = useState<string>(SAMPLE);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [snapsOpen, setSnapsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [scrollSync, setScrollSync] = useState<boolean>(true);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(true);
  const [view, setView] = useState<ViewMode>("split");
  const [search, setSearch] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [saved, setSaved] = useState(true);
  // Find & Replace
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findCase, setFindCase] = useState(false);
  const [findMatches, setFindMatches] = useState<number[]>([]);
  const [findIndex, setFindIndex] = useState(0);
  // Focus mode
  const [focusMode, setFocusMode] = useState<boolean>(false);
  // Word count goal
  const [goal, setGoal] = useState<number>(0);
  const hydratedRef = useRef(false);

  // Load persisted state from localStorage / URL hash once, after hydration.
  useEffect(() => {
    try {
      if (window.location.hash.startsWith("#s=")) {
        const decoded = LZString.decompressFromEncodedURIComponent(window.location.hash.slice(3));
        if (decoded) setContent(decoded);
        else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) setContent(stored);
        }
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setContent(stored);
      }
      try { setSnapshots(JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? "[]")); } catch { /* noop */ }
      setScrollSync(localStorage.getItem(SCROLLSYNC_KEY) !== "0");
      const savedTheme = localStorage.getItem(THEME_KEY);
      setDark(savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
      const savedView = localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (savedView) setView(savedView);
      setFocusMode(localStorage.getItem(FOCUS_KEY) === "1");
      setGoal(Number(localStorage.getItem(GOAL_KEY) ?? 0));
      // Mobile defaults: hide outline, and if no user-saved view, prefer editor on tiny screens
      if (typeof window !== "undefined" && window.innerWidth < 900) {
        setOutlineOpen(false);
        if (!localStorage.getItem(VIEW_KEY) && window.innerWidth < 640) setView("editor");
      }
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<{ stack: string[]; index: number }>({ stack: [], index: -1 });

  // theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (hydratedRef.current) localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  // persist view / focus / goal (skip until hydration finished so we don't clobber stored values)
  useEffect(() => { if (hydratedRef.current) localStorage.setItem(VIEW_KEY, view); }, [view]);
  useEffect(() => { if (hydratedRef.current) localStorage.setItem(FOCUS_KEY, focusMode ? "1" : "0"); }, [focusMode]);
  useEffect(() => { if (hydratedRef.current) localStorage.setItem(GOAL_KEY, String(goal)); }, [goal]);
  useEffect(() => { if (hydratedRef.current) localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots)); }, [snapshots]);
  useEffect(() => { if (hydratedRef.current) localStorage.setItem(SCROLLSYNC_KEY, scrollSync ? "1" : "0"); }, [scrollSync]);

  // autosave
  useEffect(() => {
    if (!hydratedRef.current) return;
    setSaved(false);
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, content);
      setSaved(true);
    }, 400);
    return () => clearTimeout(t);
  }, [content]);

  // init history
  useEffect(() => {
    if (historyRef.current.stack.length === 0) {
      historyRef.current = { stack: [content], index: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback((value: string) => {
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(value);
    if (h.stack.length > 200) h.stack.shift();
    h.index = h.stack.length - 1;
  }, []);

  const changeContent = useCallback((value: string) => {
    setContent(value);
    pushHistory(value);
  }, [pushHistory]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index > 0) {
      h.index--;
      setContent(h.stack[h.index]);
    }
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index < h.stack.length - 1) {
      h.index++;
      setContent(h.stack[h.index]);
    }
  }, []);

  const html = useMemo(() => {
    // Extract math blocks first (protect them from markdown mangling)
    const mathBlocks: string[] = [];
    let processed = content
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
        try {
          const rendered = katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
          mathBlocks.push(`<div class="ink-math-block">${rendered}</div>`);
          return `\n\nMATHBLOCK${mathBlocks.length - 1}\n\n`;
        } catch { return _; }
      })
      .replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, expr) => {
        try {
          const rendered = katex.renderToString(expr.trim(), { throwOnError: false });
          mathBlocks.push(`<span class="ink-math-inline">${rendered}</span>`);
          return `MATHBLOCK${mathBlocks.length - 1}`;
        } catch { return _; }
      });
    // Emoji shortcodes
    processed = processed.replace(/:([a-z0-9_+-]+):/g, (m, code) => EMOJI_MAP[code] ?? m);
    const raw = marked.parse(processed, { async: false }) as string;
    let withMath = raw.replace(/MATHBLOCK(\d+)/g, (_, i) => mathBlocks[Number(i)] ?? "");
    // Bake heading ids into the HTML so they survive React re-commits of dangerouslySetInnerHTML.
    withMath = withMath.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, inner) => {
      if (/\sid=/.test(attrs)) return match;
      const text = inner.replace(/<[^>]+>/g, "");
      const id = slugify(text);
      return id ? `<${tag}${attrs} id="${id}">${inner}</${tag}>` : match;
    });
    // Bake copy buttons into <pre> blocks (skip mermaid — those get replaced by SVG).
    withMath = withMath.replace(/<pre>(\s*<code(?![^>]*language-mermaid)[^>]*>[\s\S]*?<\/code>\s*)<\/pre>/g,
      (_m, inner) => `<pre style="position:relative">${inner}<button type="button" class="ink-code-copy" data-copy aria-label="Copy code">Copy</button></pre>`,
    );
    if (typeof window === "undefined") return withMath;
    return DOMPurify.sanitize(withMath, {
      ADD_ATTR: ["target", "checked", "disabled", "data-copy"],
      ADD_TAGS: ["math", "semantics", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "annotation", "svg", "path", "g", "line", "rect", "circle", "text", "tspan", "polygon", "polyline", "foreignObject", "defs", "marker"],
    });
  }, [content]);

  // Mermaid SVG cache keyed by source. Diagrams render async, but React
  // re-commits `dangerouslySetInnerHTML` on every render — detaching the
  // original <pre>. We cache the rendered SVG and re-inject on every effect run.
  const mermaidCacheRef = useRef<Map<string, string>>(new Map());
  const [mermaidTick, setMermaidTick] = useState(0);

  // Mermaid rendering: async, needs DOM access.
  useEffect(() => {
    if (!previewRef.current) return;
    const mermaidBlocks = previewRef.current.querySelectorAll("pre code.language-mermaid");
    const pendingRenders: Promise<void>[] = [];
    mermaidBlocks.forEach((el, i) => {
      const pre = el.parentElement as HTMLElement | null;
      if (!pre) return;
      const src = (el.textContent ?? "").trim();
      if (!src) return;
      const cached = mermaidCacheRef.current.get(src);
      if (cached) {
        const div = document.createElement("div");
        div.className = "ink-mermaid";
        div.innerHTML = cached;
        pre.replaceWith(div);
        return;
      }
      if (pre.dataset.pending === "1") return;
      pre.dataset.pending = "1";
      const id = `mmd-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
      pendingRenders.push(
        mermaid
          .render(id, src)
          .then(({ svg }) => { mermaidCacheRef.current.set(src, sanitizeSvg(svg)); })
          .catch((err: any) => {
            const msg = String(err?.message ?? err).replace(/</g, "&lt;");
            mermaidCacheRef.current.set(
              src,
              `<pre class="ink-mermaid-err"><code>Mermaid error: ${msg}</code></pre>`,
            );
          }),
      );
    });
    if (pendingRenders.length > 0) {
      Promise.all(pendingRenders).then(() => setMermaidTick((t) => t + 1));
    }
  }, [html, mermaidTick]);

  // Delegated click handler for copy buttons — survives DOM re-commits.
  useEffect(() => {
    const pv = previewRef.current;
    if (!pv) return;
    const onClick = async (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const btn = target.closest("button.ink-code-copy") as HTMLButtonElement | null;
      if (!btn) return;
      const pre = btn.closest("pre");
      const code = pre?.querySelector("code")?.textContent ?? "";
      ev.preventDefault();
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1400);
      } catch { /* ignore */ }
    };
    pv.addEventListener("click", onClick);
    return () => pv.removeEventListener("click", onClick);
  }, []);

  // ---------- Scroll sync (editor -> preview) ----------
  const syncingRef = useRef(false);
  const onEditorScroll = useCallback(() => {
    if (!scrollSync || syncingRef.current) return;
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
    syncingRef.current = true;
    pv.scrollTop = ratio * Math.max(0, pv.scrollHeight - pv.clientHeight);
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [scrollSync]);
  const onPreviewScroll = useCallback(() => {
    if (!scrollSync || syncingRef.current) return;
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const ratio = pv.scrollTop / Math.max(1, pv.scrollHeight - pv.clientHeight);
    syncingRef.current = true;
    ta.scrollTop = ratio * Math.max(0, ta.scrollHeight - ta.clientHeight);
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [scrollSync]);

  // ---------- Snapshots ----------
  const saveSnapshot = useCallback(() => {
    const name = window.prompt("Snapshot name:", `Snapshot ${new Date().toLocaleString()}`);
    if (!name) return;
    const snap: Snapshot = { id: `${Date.now()}`, name, content, createdAt: Date.now() };
    setSnapshots((s) => [snap, ...s].slice(0, 50));
    setShareToast(`Snapshot “${name}” saved.`);
    setTimeout(() => setShareToast(null), 2200);
  }, [content]);
  const restoreSnapshot = useCallback((snap: Snapshot) => {
    if (content.trim() && !confirm(`Restore “${snap.name}”? Current document will be replaced (you can snapshot first).`)) return;
    changeContent(snap.content);
    setSnapsOpen(false);
  }, [content]);
  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots((s) => s.filter((x) => x.id !== id));
  }, []);


  const headings = useMemo(() => extractHeadings(content), [content]);
  const s = useMemo(() => stats(content), [content]);

  // ---------- toolbar helpers ----------
  const wrap = (before: string, after = before, placeholder = "text") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || placeholder;
    const next = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    changeContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const prefixLines = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
    const chunk = ta.value.slice(lineStart, end);
    const replaced = chunk
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
      .join("\n");
    const next = ta.value.slice(0, lineStart) + replaced + ta.value.slice(end);
    changeContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + replaced.length);
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = ta.value.slice(0, start) + text + ta.value.slice(end);
    changeContent(next);
    setTimeout(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertLink = () => {
    const url = window.prompt("Link URL:", "https://");
    if (!url) return;
    wrap("[", `](${url})`, "link text");
  };
  const insertImage = () => {
    const url = window.prompt("Image URL:", "https://");
    if (!url) return;
    insertAtCursor(`![alt text](${url})`);
  };
  const insertTable = () => {
    insertAtCursor(
      "\n| Column A | Column B | Column C |\n| --- | --- | --- |\n| A1 | B1 | C1 |\n| A2 | B2 | C2 |\n",
    );
  };

  // ---------- import / export ----------
  const importFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => changeContent(String(reader.result ?? ""));
      reader.readAsText(file);
    };
    input.click();
  };

  const download = (name: string, mime: string, data: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMd = () => download("document.md", "text/markdown;charset=utf-8", content);

  // Replace mermaid <pre><code class="language-mermaid">SRC</code></pre> with cached SVGs
  const inlineMermaid = (rawHtml: string): string => {
    if (typeof window === "undefined") return rawHtml;
    const cache = mermaidCacheRef.current;
    if (cache.size === 0 && !/language-mermaid/.test(rawHtml)) return rawHtml;
    const container = document.createElement("div");
    container.innerHTML = rawHtml;
    const blocks = container.querySelectorAll("pre > code.language-mermaid");
    blocks.forEach((el) => {
      const src = (el.textContent ?? "").trim();
      const svg = cache.get(src);
      const pre = el.parentElement;
      if (!pre) return;
      const wrap = document.createElement("div");
      wrap.className = "ink-mermaid";
      wrap.innerHTML = svg ?? `<pre><code>${(el as HTMLElement).innerHTML}</code></pre>`;
      pre.replaceWith(wrap);
    });
    return container.innerHTML;
  };

  const buildDocumentHtml = (opts: { title: string; forPrint?: boolean }): string => {
    const body = inlineMermaid(html);
    const title = (opts.title || "Document").replace(/</g, "&lt;");
    const printCss = opts.forPrint
      ? `@page{margin:18mm}@media print{a{color:inherit;text-decoration:none}pre,blockquote,table,.ink-mermaid,figure{break-inside:avoid;page-break-inside:avoid}h1,h2,h3{break-after:avoid;page-break-after:avoid}}`
      : "";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/github.min.css" crossorigin="anonymous" />
<style>
  :root{--fg:#1a1a2e;--muted:#5b6478;--bg:#ffffff;--surface:#f7f8fb;--border:#e6e8ef;--accent:#6d3bff;--accent2:#0ea5b7;--code-bg:#0d1117;--code-fg:#e6edf3}
  *{box-sizing:border-box}
  html,body{background:var(--bg);color:var(--fg)}
  body{max-width:820px;margin:2.5rem auto;padding:0 1.5rem;font:16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased}
  h1,h2,h3,h4,h5,h6{line-height:1.25;margin:2rem 0 .75rem;font-weight:700;letter-spacing:-0.01em}
  h1{font-size:2.15rem;background:linear-gradient(135deg,#6d3bff,#e0378d 45%,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent;border-bottom:1px solid var(--border);padding-bottom:.4rem}
  h2{font-size:1.6rem;color:#3b1f8b}
  h3{font-size:1.25rem;color:#0e7490}
  h4{font-size:1.05rem;color:#b45309}
  p{margin:0 0 1rem}
  a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
  hr{border:0;height:1px;background:var(--border);margin:2rem 0}
  ul,ol{padding-left:1.5rem;margin:0 0 1rem}
  li{margin:.25rem 0}
  blockquote{margin:1rem 0;padding:.75rem 1.15rem;border-left:4px solid var(--accent);background:linear-gradient(90deg,rgba(109,59,255,.08),rgba(14,165,183,.04));border-radius:0 8px 8px 0;color:#3b3f52}
  code{font:0.92em/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  :not(pre) > code{background:var(--surface);border:1px solid var(--border);padding:.1em .4em;border-radius:5px;color:#a21caf}
  pre{background:var(--code-bg);color:var(--code-fg);padding:1rem 1.15rem;border-radius:10px;overflow:auto;margin:1rem 0;font-size:.9rem;line-height:1.55}
  pre code.hljs{background:transparent;padding:0;color:inherit}
  table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.95rem}
  th,td{border:1px solid var(--border);padding:.5rem .8rem;text-align:left}
  th{background:var(--surface);font-weight:600}
  img{max-width:100%;height:auto;border-radius:8px}
  .ink-mermaid{margin:1.25rem 0;padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:10px;text-align:center}
  .ink-mermaid svg{max-width:100%;height:auto}
  .task-list-item{list-style:none;margin-left:-1.25rem}
  .task-list-item input{margin-right:.5rem}
  .katex-display{overflow-x:auto;overflow-y:hidden;padding:.25rem 0}
  ${printCss}
</style>
</head>
<body>${body}</body>
</html>`;
  };

  const exportHtml = () => {
    download("document.html", "text/html;charset=utf-8", buildDocumentHtml({ title: "Document" }));
  };

  const exportPdf = () => {
    const doc = buildDocumentHtml({ title: "Document", forPrint: true });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(doc);
    w.document.close();
    // Wait for external stylesheets (KaTeX/highlight.js) to load before printing
    const trigger = () => {
      try { w.focus(); w.print(); } catch { /* noop */ }
    };
    if (w.document.readyState === "complete") {
      setTimeout(trigger, 500);
    } else {
      w.addEventListener("load", () => setTimeout(trigger, 400));
    }
  };

  const copyMd = async () => {
    await navigator.clipboard.writeText(content);
  };
  const copyHtml = async () => {
    await navigator.clipboard.writeText(html);
  };

  const clearAll = () => {
    if (confirm("Clear the entire document? This cannot be undone.")) {
      changeContent("");
    }
  };

  // ---------- Share via URL ----------
  const shareUrl = async () => {
    const compressed = LZString.compressToEncodedURIComponent(content);
    const url = `${window.location.origin}${window.location.pathname}#s=${compressed}`;
    if (url.length > 8000) {
      setShareToast(`Document too large to share via URL (${url.length} chars).`);
      setTimeout(() => setShareToast(null), 3000);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareToast(`Share link copied! (${url.length} chars)`);
    } catch {
      setShareToast(`Link: ${url.slice(0, 60)}…`);
    }
    setTimeout(() => setShareToast(null), 3000);
  };

  const applyTemplate = (tpl: string) => {
    if (content.trim() && !confirm("Replace current document with template?")) return;
    changeContent(tpl);
    setTemplatesOpen(false);
  };

  // ---------- Find & Replace ----------
  const computeMatches = useCallback((q: string, cs: boolean) => {
    if (!q) return [] as number[];
    const hay = cs ? content : content.toLowerCase();
    const needle = cs ? q : q.toLowerCase();
    const out: number[] = [];
    let i = 0;
    while (i <= hay.length - needle.length) {
      const p = hay.indexOf(needle, i);
      if (p === -1) break;
      out.push(p);
      i = p + Math.max(needle.length, 1);
    }
    return out;
  }, [content]);

  useEffect(() => {
    const m = computeMatches(findQuery, findCase);
    setFindMatches(m);
    setFindIndex(0);
  }, [findQuery, findCase, computeMatches]);

  const focusMatch = useCallback((idx: number) => {
    const ta = textareaRef.current;
    if (!ta || findMatches.length === 0) return;
    const pos = findMatches[idx];
    ta.focus();
    ta.setSelectionRange(pos, pos + findQuery.length);
    const lineHeight = 24;
    const before = content.slice(0, pos).split("\n").length - 1;
    ta.scrollTop = Math.max(0, before * lineHeight - 100);
  }, [findMatches, findQuery, content]);

  const nextMatch = () => {
    if (findMatches.length === 0) return;
    const n = (findIndex + 1) % findMatches.length;
    setFindIndex(n); focusMatch(n);
  };
  const prevMatch = () => {
    if (findMatches.length === 0) return;
    const n = (findIndex - 1 + findMatches.length) % findMatches.length;
    setFindIndex(n); focusMatch(n);
  };
  const replaceOne = () => {
    if (findMatches.length === 0) return;
    const pos = findMatches[findIndex];
    const next = content.slice(0, pos) + replaceQuery + content.slice(pos + findQuery.length);
    changeContent(next);
  };
  const replaceAll = () => {
    if (!findQuery) return;
    if (findCase) {
      changeContent(content.split(findQuery).join(replaceQuery));
    } else {
      const re = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      changeContent(content.replace(re, replaceQuery));
    }
  };
  const openFind = () => {
    setFindOpen(true);
    setTimeout(() => findInputRef.current?.focus(), 20);
  };

  // ---------- shortcuts ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "p" || (e.shiftKey && e.key === "P"))) { e.preventDefault(); setCmdOpen(true); setCmdQuery(""); return; }
      if (e.key === "?" && !mod) {
        const ae = document.activeElement;
        const tag = ae?.tagName;
        if (tag !== "TEXTAREA" && tag !== "INPUT") { e.preventDefault(); setCheatOpen(true); return; }
      }
      if (mod && e.shiftKey && (e.key === "s" || e.key === "S")) { e.preventDefault(); saveSnapshot(); return; }
      if (mod && e.key === "f") { e.preventDefault(); openFind(); return; }
      if (mod && e.key === "h") { e.preventDefault(); openFind(); return; }
      if (mod && e.key === ".") { e.preventDefault(); setFocusMode((v) => !v); return; }
      if (e.key === "Escape") {
        if (cmdOpen) { e.preventDefault(); setCmdOpen(false); return; }
        if (templatesOpen) { e.preventDefault(); setTemplatesOpen(false); return; }
        if (cheatOpen) { e.preventDefault(); setCheatOpen(false); return; }
        if (snapsOpen) { e.preventDefault(); setSnapsOpen(false); return; }
        if (findOpen) { e.preventDefault(); setFindOpen(false); return; }
      }
      if (findOpen && e.key === "Enter" && document.activeElement === findInputRef.current) {
        e.preventDefault(); e.shiftKey ? prevMatch() : nextMatch(); return;
      }
      if (!mod) return;
      if (e.key === "b") { e.preventDefault(); wrap("**"); }
      else if (e.key === "i") { e.preventDefault(); wrap("_"); }
      else if (e.key === "k") { e.preventDefault(); insertLink(); }
      else if (e.key === "s") { e.preventDefault(); localStorage.setItem(STORAGE_KEY, content); setSaved(true); }
      else if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
      else if (e.key === "/") { e.preventDefault(); (document.getElementById("outline-search") as HTMLInputElement)?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [content, undo, redo, findOpen, cmdOpen, templatesOpen, cheatOpen, snapsOpen, findIndex, findMatches, findQuery, replaceQuery, focusMatch, saveSnapshot]);

  // drag & drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return;
    const reader = new FileReader();
    reader.onload = () => changeContent(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  // tab in textarea inserts 2 spaces
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = ta.value.slice(0, start) + "  " + ta.value.slice(end);
      changeContent(next);
      setTimeout(() => ta.setSelectionRange(start + 2, start + 2), 0);
    }
  };

  const filteredHeadings = search
    ? headings.filter((h) => h.text.toLowerCase().includes(search.toLowerCase()))
    : headings;

  const scrollToHeading = (h: Heading) => {
    const el = previewRef.current?.querySelector(`#${CSS.escape(h.id)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    const ta = textareaRef.current;
    if (ta) {
      const lines = ta.value.split("\n");
      let pos = 0;
      for (let i = 0; i < h.line; i++) pos += lines[i].length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos + lines[h.line].length);
      // scroll textarea
      const lineHeight = 24;
      ta.scrollTop = h.line * lineHeight - 100;
    }
  };

  return (
    <div className={`ink-root ${focusMode ? "focus-mode" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {/* Find & Replace overlay */}
      {findOpen && (
        <div className="ink-find-panel" role="dialog" aria-label="Find and replace">
          <div className="ink-find-row">
            <Search size={14} />
            <input
              ref={findInputRef}
              className="ink-find-input"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Find in document…"
            />
            <span className="ink-find-count">
              {findMatches.length === 0 ? "0/0" : `${findIndex + 1}/${findMatches.length}`}
            </span>
            <button className="ink-find-btn" onClick={prevMatch} title="Previous  ⇧↵" aria-label="Previous match"><ChevronUp size={14} /></button>
            <button className="ink-find-btn" onClick={nextMatch} title="Next  ↵" aria-label="Next match"><ChevronDown size={14} /></button>
            <button
              className={`ink-find-btn ${findCase ? "on" : ""}`}
              onClick={() => setFindCase((v) => !v)}
              title="Match case"
              aria-label="Match case"
              aria-pressed={findCase}
            >Aa</button>
            <button className="ink-find-btn" onClick={() => setFindOpen(false)} title="Close  Esc" aria-label="Close find and replace"><X size={14} /></button>
          </div>
          <div className="ink-find-row">
            <Replace size={14} />
            <input
              className="ink-find-input"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with…"
            />
            <button className="ink-find-btn wide" onClick={replaceOne} disabled={findMatches.length === 0}>Replace</button>
            <button className="ink-find-btn wide" onClick={replaceAll} disabled={!findQuery}>All</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="ink-header">
        <div className="ink-brand">
          <div className="ink-logo" aria-hidden="true"><Sparkles size={18} /></div>
          <div>
            <h1 className="ink-brand-name" aria-label="Inkwell — Markdown Studio">
              Inkwell<span className="sr-only"> — Markdown Studio</span>
            </h1>
            <div className="ink-brand-sub" aria-hidden="true">Markdown Studio</div>
          </div>
        </div>

        <div className="ink-toolbar">
          <ToolGroup>
            <ToolBtn title="Bold  ⌘B" onClick={() => wrap("**")}><Bold size={15} /></ToolBtn>
            <ToolBtn title="Italic  ⌘I" onClick={() => wrap("_")}><Italic size={15} /></ToolBtn>
            <ToolBtn title="Strike" onClick={() => wrap("~~")}><Strikethrough size={15} /></ToolBtn>
            <ToolBtn title="Inline code" onClick={() => wrap("`")}><Code size={15} /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Heading 1" onClick={() => prefixLines("# ")}><Heading1 size={15} /></ToolBtn>
            <ToolBtn title="Heading 2" onClick={() => prefixLines("## ")}><Heading2 size={15} /></ToolBtn>
            <ToolBtn title="Heading 3" onClick={() => prefixLines("### ")}><Heading3 size={15} /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Bulleted list" onClick={() => prefixLines("- ")}><List size={15} /></ToolBtn>
            <ToolBtn title="Numbered list" onClick={() => prefixLines("1. ")}><ListOrdered size={15} /></ToolBtn>
            <ToolBtn title="Task" onClick={() => prefixLines("- [ ] ")}><CheckSquare size={15} /></ToolBtn>
            <ToolBtn title="Quote" onClick={() => prefixLines("> ")}><Quote size={15} /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Link  ⌘K" onClick={insertLink}><LinkIcon size={15} /></ToolBtn>
            <ToolBtn title="Image" onClick={insertImage}><ImageIcon size={15} /></ToolBtn>
            <ToolBtn title="Table" onClick={insertTable}><TableIcon size={15} /></ToolBtn>
            <ToolBtn title="Divider" onClick={() => insertAtCursor("\n\n---\n\n")}><Minus size={15} /></ToolBtn>
            <ToolBtn title="Code block" onClick={() => insertAtCursor("\n```ts\n\n```\n")}><FileText size={15} /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Undo  ⌘Z" onClick={undo}><Undo2 size={15} /></ToolBtn>
            <ToolBtn title="Redo  ⇧⌘Z" onClick={redo}><Redo2 size={15} /></ToolBtn>
          </ToolGroup>
        </div>

        <div className="ink-right">
          <div className="ink-view-toggle" role="tablist" aria-label="View">
            <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")} title="Editor only" aria-label="Editor only">
              <EyeOff size={14} /> Edit
            </button>
            <button className={view === "split" ? "active" : ""} onClick={() => setView("split")} title="Split view" aria-label="Split view">
              <Columns2 size={14} /> Split
            </button>
            <button className={view === "preview" ? "active" : ""} onClick={() => setView("preview")} title="Preview only" aria-label="Preview only">
              <Eye size={14} /> Preview
            </button>
          </div>

          <div className="ink-menu">
            <button className="ink-icon-btn" title="Command palette  ⌘P" aria-label="Command palette" onClick={() => { setCmdOpen(true); setCmdQuery(""); }}><Command size={15} /></button>
            <button className="ink-icon-btn" title="Templates" aria-label="Templates" onClick={() => setTemplatesOpen(true)}><BookTemplate size={15} /></button>
            <button className="ink-icon-btn" title="Snapshots" aria-label="Snapshots" onClick={() => setSnapsOpen(true)}><History size={15} /></button>
            <button className={`ink-icon-btn ${scrollSync ? "on" : ""}`} title={`Scroll sync: ${scrollSync ? "on" : "off"}`} aria-label={`Scroll sync: ${scrollSync ? "on" : "off"}`} aria-pressed={scrollSync} onClick={() => setScrollSync((v) => !v)}><Columns2 size={15} /></button>
            <button className="ink-icon-btn" title="Keyboard shortcuts  ?" aria-label="Keyboard shortcuts" onClick={() => setCheatOpen(true)}><Keyboard size={15} /></button>
            <button className="ink-icon-btn" title="Share via URL" aria-label="Share via URL" onClick={shareUrl}><Share2 size={15} /></button>
            <button className="ink-icon-btn" title="Find & Replace  ⌘F" aria-label="Find and replace" onClick={openFind}><Search size={15} /></button>
            <button className="ink-icon-btn" title="Import .md" aria-label="Import markdown file" onClick={importFile}><Upload size={15} /></button>
            <div className="ink-dropdown">
              <button className="ink-icon-btn" title="Export" aria-label="Export"><Download size={15} /></button>
              <div className="ink-dropdown-menu">
                <button onClick={exportMd}><FileDown size={14} /> Export .md</button>
                <button onClick={exportHtml}><FileDown size={14} /> Export .html</button>
                <button onClick={exportPdf}><Printer size={14} /> Export .pdf (print)</button>
                <div className="ink-menu-sep" />
                <button onClick={copyMd}><Copy size={14} /> Copy markdown</button>
                <button onClick={copyHtml}><Copy size={14} /> Copy HTML</button>
              </div>
            </div>
            <button className="ink-icon-btn" title="Clear document" aria-label="Clear document" onClick={clearAll}><Trash2 size={15} /></button>
            <button
              className={`ink-icon-btn ${focusMode ? "on" : ""}`}
              title="Focus mode  ⌘."
              aria-label="Toggle focus mode"
              aria-pressed={focusMode}
              onClick={() => setFocusMode((v) => !v)}
            ><Focus size={15} /></button>
            <button className="ink-icon-btn" title="Toggle theme" aria-label="Toggle theme" onClick={() => setDark((d) => !d)}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>


      {/* Body */}
      <main className="ink-body">
        {/* Outline */}
        {outlineOpen && (
          <div
            className="ink-outline-backdrop"
            onClick={() => setOutlineOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside className={`ink-outline ${outlineOpen ? "" : "collapsed"}`}>
          <div className="ink-outline-head">
            <button
              className="ink-icon-btn ink-outline-toggle"
              onClick={() => setOutlineOpen((v) => !v)}
              title="Toggle outline"
              aria-label={outlineOpen ? "Close outline" : "Open outline"}
            >
              {outlineOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
            {outlineOpen && <span className="ink-outline-title">Outline</span>}
          </div>
          {outlineOpen && (
            <>
              <div className="ink-outline-search">
                <Search size={13} />
                <input
                  id="outline-search"
                  placeholder="Filter headings…  /"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <nav className="ink-outline-list">
                {filteredHeadings.length === 0 && (
                  <div className="ink-outline-empty">No headings yet.</div>
                )}
                {filteredHeadings.map((h, i) => (
                  <button
                    key={`${h.id}-${i}`}
                    className="ink-outline-item"
                    style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                    onClick={() => {
                      scrollToHeading(h);
                      if (typeof window !== "undefined" && window.innerWidth < 900) {
                        setOutlineOpen(false);
                      }
                    }}
                    title={h.text}
                  >
                    <span className={`ink-h-tag ink-h-${h.level}`}>H{h.level}</span>
                    <span className="ink-h-text">{h.text}</span>
                  </button>
                ))}
              </nav>
            </>
          )}
        </aside>


        {/* Panes */}
        <section className={`ink-panes ink-view-${view}`}>
          {view !== "preview" && (
            <div className="ink-pane ink-editor-pane">
              <div className="ink-pane-label">MARKDOWN</div>
              <textarea
                ref={textareaRef}
                className="ink-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={onKeyDown}
                onScroll={onEditorScroll}
                spellCheck
                placeholder="Start writing markdown…  drag a .md file here to import."
              />
            </div>
          )}
          {view !== "editor" && (
            <div className="ink-pane ink-preview-pane">
              <div className="ink-pane-label">PREVIEW</div>
              <article
                ref={previewRef}
                className="ink-prose"
                onScroll={onPreviewScroll}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="ink-footer">
        <div className="ink-stats">
          <span><b>{s.words.toLocaleString()}</b> words</span>
          <span><b>{s.chars.toLocaleString()}</b> chars</span>
          <span><b>{s.lines.toLocaleString()}</b> lines</span>
          <span><b>~{s.readMin} min</b> read</span>
        </div>
        <div className="ink-footer-right">
          <GoalWidget words={s.words} goal={goal} setGoal={setGoal} />
          <div className="ink-save">
            <span className={`ink-dot ${saved ? "saved" : "saving"}`} />
            {saved ? "Saved locally" : "Saving…"}
          </div>
        </div>
      </footer>


      {shareToast && <div className="ink-toast">{shareToast}</div>}

      {templatesOpen && (
        <div className="ink-modal-backdrop" onClick={() => setTemplatesOpen(false)}>
          <div className="ink-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ink-modal-head">
              <BookTemplate size={16} />
              <span>Templates</span>
              <button className="ink-modal-close" aria-label="Close templates" onClick={() => setTemplatesOpen(false)}><X size={16} /></button>
            </div>
            <div className="ink-tpl-grid">
              {TEMPLATES.map((t) => (
                <button key={t.name} className="ink-tpl-card" onClick={() => applyTemplate(t.content)}>
                  <span className="ink-tpl-icon">{t.icon}</span>
                  <span className="ink-tpl-name">{t.name}</span>
                  <span className="ink-tpl-preview">{t.content.split("\n").slice(0, 2).join(" · ").slice(0, 80)}…</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {cmdOpen && (
        <CommandPalette
          query={cmdQuery}
          setQuery={setCmdQuery}
          close={() => setCmdOpen(false)}
          actions={[
            { id: "bold", label: "Bold", hint: "⌘B", run: () => wrap("**") },
            { id: "italic", label: "Italic", hint: "⌘I", run: () => wrap("_") },
            { id: "h1", label: "Heading 1", run: () => prefixLines("# ") },
            { id: "h2", label: "Heading 2", run: () => prefixLines("## ") },
            { id: "h3", label: "Heading 3", run: () => prefixLines("### ") },
            { id: "list", label: "Bulleted list", run: () => prefixLines("- ") },
            { id: "task", label: "Task list", run: () => prefixLines("- [ ] ") },
            { id: "quote", label: "Quote", run: () => prefixLines("> ") },
            { id: "link", label: "Insert link", hint: "⌘K", run: insertLink },
            { id: "image", label: "Insert image", run: insertImage },
            { id: "table", label: "Insert table", run: insertTable },
            { id: "code", label: "Insert code block", run: () => insertAtCursor("\n```ts\n\n```\n") },
            { id: "math-inline", label: "Insert math (inline)", run: () => wrap("$") },
            { id: "math-block", label: "Insert math (block)", run: () => insertAtCursor("\n$$\n\n$$\n") },
            { id: "mermaid", label: "Insert Mermaid diagram", run: () => insertAtCursor("\n```mermaid\nflowchart LR\n  A --> B\n```\n") },
            { id: "toc", label: "Insert table of contents", run: () => insertAtCursor("\n" + headings.map(h => `${"  ".repeat(h.level - 1)}- [${h.text}](#${h.id})`).join("\n") + "\n") },
            { id: "find", label: "Find & Replace", hint: "⌘F", run: openFind },
            { id: "focus", label: "Toggle focus mode", hint: "⌘.", run: () => setFocusMode((v) => !v) },
            { id: "theme", label: "Toggle theme", run: () => setDark((d) => !d) },
            { id: "share", label: "Copy share URL", run: shareUrl },
            { id: "templates", label: "Open templates…", run: () => { setCmdOpen(false); setTemplatesOpen(true); } },
            { id: "snap-save", label: "Save snapshot…", hint: "⇧⌘S", run: saveSnapshot },
            { id: "snap-open", label: "Open snapshots…", run: () => { setCmdOpen(false); setSnapsOpen(true); } },
            { id: "cheat", label: "Keyboard shortcuts…", hint: "?", run: () => { setCmdOpen(false); setCheatOpen(true); } },
            { id: "scrollsync", label: `Scroll sync: ${scrollSync ? "on" : "off"}`, run: () => setScrollSync((v) => !v) },
            { id: "export-md", label: "Export as .md", run: exportMd },
            { id: "export-html", label: "Export as .html", run: exportHtml },
            { id: "export-pdf", label: "Export as .pdf", run: exportPdf },
            { id: "copy-md", label: "Copy markdown to clipboard", run: copyMd },
            { id: "copy-html", label: "Copy HTML to clipboard", run: copyHtml },
            { id: "import", label: "Import .md file", run: importFile },
            { id: "clear", label: "Clear document…", run: clearAll },
            ...headings.map((h) => ({
              id: `goto-${h.id}-${h.line}`,
              label: `Go to → ${h.text}`,
              hint: `H${h.level}`,
              run: () => scrollToHeading(h),
            })),
          ]}
        />
      )}

      {snapsOpen && (
        <div className="ink-modal-backdrop" onClick={() => setSnapsOpen(false)}>
          <div className="ink-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ink-modal-head">
              <History size={16} />
              <span>Snapshots</span>
              <button className="ink-icon-btn" style={{ marginLeft: "auto" }} onClick={saveSnapshot} title="Save current as snapshot" aria-label="Save current as snapshot">
                <Save size={14} />
              </button>
              <button className="ink-modal-close" aria-label="Close snapshots" onClick={() => setSnapsOpen(false)}><X size={16} /></button>
            </div>
            <div className="ink-snap-list">
              {snapshots.length === 0 && (
                <div className="ink-snap-empty">No snapshots yet. Save one with ⇧⌘S to preserve a version.</div>
              )}
              {snapshots.map((snap) => (
                <div key={snap.id} className="ink-snap-item">
                  <div className="ink-snap-info">
                    <div className="ink-snap-name">{snap.name}</div>
                    <div className="ink-snap-meta">
                      {new Date(snap.createdAt).toLocaleString()} · {snap.content.length.toLocaleString()} chars
                    </div>
                  </div>
                  <button className="ink-snap-btn" onClick={() => restoreSnapshot(snap)} title="Restore this snapshot">
                    <RotateCcw size={13} /> Restore
                  </button>
                  <button className="ink-snap-btn danger" onClick={() => deleteSnapshot(snap.id)} title="Delete snapshot" aria-label="Delete snapshot">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cheatOpen && (
        <div className="ink-modal-backdrop" onClick={() => setCheatOpen(false)}>
          <div className="ink-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ink-modal-head">
              <Keyboard size={16} />
              <span>Keyboard shortcuts</span>
              <button className="ink-modal-close" aria-label="Close shortcuts" onClick={() => setCheatOpen(false)}><X size={16} /></button>
            </div>
            <div className="ink-cheat">
              {[
                ["Command palette", "⌘P"],
                ["Find & replace", "⌘F"],
                ["Bold", "⌘B"],
                ["Italic", "⌘I"],
                ["Insert link", "⌘K"],
                ["Save", "⌘S"],
                ["Save snapshot", "⇧⌘S"],
                ["Undo", "⌘Z"],
                ["Redo", "⇧⌘Z"],
                ["Focus mode", "⌘."],
                ["Filter outline", "⌘/"],
                ["Show shortcuts", "?"],
                ["Close overlay", "Esc"],
                ["Next/prev match (in Find)", "↵ / ⇧↵"],
              ].map(([label, keys]) => (
                <div key={label} className="ink-cheat-row">
                  <span>{label}</span>
                  <span className="ink-cheat-keys">{keys}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

interface CmdAction { id: string; label: string; hint?: string; run: () => void }
function CommandPalette({ query, setQuery, close, actions }: {
  query: string; setQuery: (s: string) => void; close: () => void; actions: CmdAction[];
}) {
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? actions.filter((a) => a.label.toLowerCase().includes(q))
    : actions;
  useEffect(() => { setIdx(0); }, [query]);
  const run = (a: CmdAction) => { a.run(); close(); };
  return (
    <div className="ink-modal-backdrop" onClick={close}>
      <div className="ink-cmd" onClick={(e) => e.stopPropagation()}>
        <div className="ink-cmd-input-row">
          <Command size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); if (filtered[idx]) run(filtered[idx]); }
            }}
            placeholder="Type a command or search…"
          />
          <span className="ink-cmd-kbd">esc</span>
        </div>
        <div className="ink-cmd-list">
          {filtered.length === 0 && <div className="ink-cmd-empty">No results.</div>}
          {filtered.slice(0, 60).map((a, i) => (
            <button
              key={a.id}
              className={`ink-cmd-item ${i === idx ? "active" : ""}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(a)}
            >
              <span>{a.label}</span>
              {a.hint && <span className="ink-cmd-hint">{a.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="ink-tool-group">{children}</div>;
}
function ToolBtn({
  children, onClick, title,
}: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button className="ink-tool-btn" onClick={onClick} title={title} aria-label={title} type="button">
      {children}
    </button>
  );
}

function GoalWidget({ words, goal, setGoal }: { words: number; goal: number; setGoal: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(goal || 500));
  const pct = goal > 0 ? Math.min(1, words / goal) : 0;
  const done = goal > 0 && words >= goal;
  const r = 8, c = 2 * Math.PI * r;
  return (
    <div className="ink-goal">
      <button className="ink-goal-btn" onClick={() => setOpen((v) => !v)} title="Word count goal">
        {goal > 0 ? (
          <>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2.5" />
              <circle cx="11" cy="11" r={r} fill="none" stroke={done ? "var(--ink-accent-2)" : "var(--ink-accent)"}
                strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
                transform="rotate(-90 11 11)" style={{ transition: "stroke-dashoffset 300ms ease" }} />
            </svg>
            <span>{done ? <Check size={12} /> : `${Math.round(pct * 100)}%`}</span>
            <span className="ink-goal-sub">{words}/{goal}</span>
          </>
        ) : (
          <><Target size={13} /> <span>Set goal</span></>
        )}
      </button>
      {open && (
        <div className="ink-goal-pop">
          <label>Daily word goal</label>
          <div className="ink-goal-row">
            <input
              type="number" min="0" step="50"
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setGoal(Math.max(0, Number(draft) || 0)); setOpen(false); }
                if (e.key === "Escape") setOpen(false);
              }}
              autoFocus
            />
            <button onClick={() => { setGoal(Math.max(0, Number(draft) || 0)); setOpen(false); }}>Set</button>
          </div>
          <div className="ink-goal-presets">
            {[250, 500, 1000, 2000].map((n) => (
              <button key={n} onClick={() => { setGoal(n); setDraft(String(n)); setOpen(false); }}>{n}</button>
            ))}
            {goal > 0 && (
              <button className="clear" onClick={() => { setGoal(0); setOpen(false); }}>Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = /* css */ `
:root {
  --ink-bg: #fbf7ff;
  --ink-panel: #ffffff;
  --ink-panel-2: #f4eeff;
  --ink-border: rgba(60, 20, 90, 0.10);
  --ink-border-strong: rgba(60, 20, 90, 0.18);
  --ink-text: #16121f;
  --ink-text-2: #5c5470;
  --ink-text-3: #9990ad;
  --ink-accent: #7c3aed;       /* violet */
  --ink-accent-2: #06b6d4;     /* cyan */
  --ink-accent-3: #ec4899;     /* pink */
  --ink-accent-4: #f59e0b;     /* amber */
  --ink-accent-5: #10b981;     /* emerald */
  --ink-gradient: linear-gradient(135deg, #7c3aed 0%, #ec4899 45%, #f59e0b 100%);
  --ink-gradient-cool: linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%);
  --ink-shadow: 0 1px 2px rgba(60, 20, 90, 0.06), 0 12px 40px rgba(124, 58, 237, 0.10);
}
.dark {
  --ink-bg: #0b0813;
  --ink-panel: #15111f;
  --ink-panel-2: #1c1730;
  --ink-border: rgba(180, 150, 255, 0.10);
  --ink-border-strong: rgba(180, 150, 255, 0.22);
  --ink-text: #ede9f7;
  --ink-text-2: #a89fc4;
  --ink-text-3: #6f668a;
  --ink-accent: #a78bfa;
  --ink-accent-2: #22d3ee;
  --ink-accent-3: #f472b6;
  --ink-accent-4: #fbbf24;
  --ink-accent-5: #34d399;
  --ink-gradient: linear-gradient(135deg, #a78bfa 0%, #f472b6 45%, #fbbf24 100%);
  --ink-gradient-cool: linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%);
  --ink-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 40px rgba(124, 58, 237, 0.22);
}

.ink-root {
  min-height: 100dvh;
  background:
    radial-gradient(ellipse 60% 40% at 15% 0%, color-mix(in oklab, var(--ink-accent) 18%, transparent), transparent 60%),
    radial-gradient(ellipse 50% 35% at 85% 10%, color-mix(in oklab, var(--ink-accent-2) 16%, transparent), transparent 60%),
    radial-gradient(ellipse 70% 45% at 50% 100%, color-mix(in oklab, var(--ink-accent-3) 14%, transparent), transparent 65%),
    var(--ink-bg);
  color: var(--ink-text);
  display: grid;
  grid-template-rows: auto 1fr auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-feature-settings: 'ss01', 'cv11';
  letter-spacing: -0.005em;
}

/* Header */
.ink-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 12px 20px;
  background: color-mix(in oklab, var(--ink-panel) 78%, transparent);
  border-bottom: 1px solid var(--ink-border);
  position: sticky; top: 0; z-index: 20;
  backdrop-filter: saturate(1.4) blur(14px);
}
.ink-brand { display: flex; align-items: center; gap: 12px; }
.ink-logo {
  width: 34px; height: 34px; border-radius: 10px;
  background: var(--ink-gradient);
  color: white; display: grid; place-items: center;
  box-shadow: 0 6px 20px color-mix(in oklab, var(--ink-accent) 40%, transparent);
}
.ink-brand-name {
  font-weight: 700; font-size: 15px; letter-spacing: -0.01em;
  background: var(--ink-gradient);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ink-brand-sub { font-size: 11px; color: var(--ink-text-3); letter-spacing: 0.04em; text-transform: uppercase; }

.ink-toolbar { display: flex; gap: 4px; align-items: center; overflow-x: auto; scrollbar-width: none; }
.ink-toolbar::-webkit-scrollbar { display: none; }
.ink-tool-group {
  display: flex; align-items: center;
  padding: 2px; gap: 2px;
  border-radius: 8px;
  background: var(--ink-panel-2);
  border: 1px solid var(--ink-border);
}
.ink-tool-group + .ink-tool-group { margin-left: 4px; }
.ink-tool-btn {
  width: 30px; height: 30px; border-radius: 6px;
  background: transparent; border: 0; color: var(--ink-text-2);
  display: grid; place-items: center; cursor: pointer;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;
}
.ink-tool-btn:hover { background: var(--ink-panel); color: var(--ink-text); }
.ink-tool-btn:active { transform: scale(0.94); }

.ink-right { display: flex; align-items: center; gap: 8px; }
.ink-view-toggle {
  display: flex; padding: 2px; background: var(--ink-panel-2);
  border-radius: 8px; border: 1px solid var(--ink-border);
}
.ink-view-toggle button {
  padding: 6px 10px; font-size: 12px; font-weight: 500;
  background: transparent; border: 0; border-radius: 6px;
  color: var(--ink-text-2); cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 120ms ease;
}
.ink-view-toggle button:hover { color: var(--ink-text); }
.ink-view-toggle button.active {
  background: var(--ink-panel); color: var(--ink-text);
  box-shadow: var(--ink-shadow);
}

.ink-menu { display: flex; align-items: center; gap: 4px; }
.ink-icon-btn {
  width: 34px; height: 34px; border-radius: 8px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  color: var(--ink-text-2); display: grid; place-items: center;
  cursor: pointer; transition: all 120ms ease;
}
.ink-icon-btn:hover { color: var(--ink-text); border-color: var(--ink-border-strong); }
.ink-icon-btn:active { transform: scale(0.94); }

.ink-dropdown { position: relative; }
.ink-dropdown-menu {
  position: absolute; right: 0; top: calc(100% + 6px);
  min-width: 200px; padding: 6px;
  background: var(--ink-panel); border: 1px solid var(--ink-border-strong);
  border-radius: 10px; box-shadow: var(--ink-shadow);
  opacity: 0; pointer-events: none; transform: translateY(-4px);
  transition: opacity 140ms ease, transform 140ms ease;
  z-index: 30;
}
.ink-dropdown:hover .ink-dropdown-menu,
.ink-dropdown:focus-within .ink-dropdown-menu { opacity: 1; pointer-events: auto; transform: translateY(0); }
.ink-dropdown-menu button {
  width: 100%; text-align: left; padding: 8px 10px; border: 0; background: transparent;
  color: var(--ink-text); font-size: 13px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
}
.ink-dropdown-menu button:hover { background: var(--ink-panel-2); }
.ink-menu-sep { height: 1px; background: var(--ink-border); margin: 4px 2px; }

/* Body */
.ink-body { display: grid; grid-template-columns: auto 1fr; min-height: 0; }

/* Outline */
.ink-outline {
  width: 260px; background: var(--ink-panel);
  border-right: 1px solid var(--ink-border);
  display: flex; flex-direction: column;
  transition: width 200ms ease;
}
.ink-outline.collapsed { width: 44px; }
.ink-outline-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px; border-bottom: 1px solid var(--ink-border);
}
.ink-outline-title {
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ink-text-3); font-weight: 600;
}
.ink-outline-search {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; margin: 8px; border-radius: 8px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
}
.ink-outline-search input {
  background: transparent; border: 0; outline: 0; flex: 1;
  font-size: 12px; color: var(--ink-text);
}
.ink-outline-search input::placeholder { color: var(--ink-text-3); }
.ink-outline-list { flex: 1; overflow-y: auto; padding: 4px; }
.ink-outline-empty { padding: 12px; font-size: 12px; color: var(--ink-text-3); }
.ink-outline-item {
  width: 100%; text-align: left; padding: 6px 10px;
  background: transparent; border: 0; border-radius: 6px;
  color: var(--ink-text-2); cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; line-height: 1.3;
}
.ink-outline-item:hover { background: var(--ink-panel-2); color: var(--ink-text); }
.ink-h-tag {
  font-size: 9px; padding: 2px 5px; border-radius: 4px;
  background: var(--ink-panel-2); color: var(--ink-text-3);
  border: 1px solid var(--ink-border);
  font-family: ui-monospace, SFMono-Regular, monospace;
  flex-shrink: 0;
}
.ink-h-1 { color: var(--ink-accent); }
.ink-h-2 { color: var(--ink-accent-2); }
.ink-h-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Panes */
.ink-panes { display: grid; min-height: 0; }
.ink-view-split { grid-template-columns: 1fr 1fr; }
.ink-view-editor, .ink-view-preview { grid-template-columns: 1fr; }
.ink-pane {
  min-height: 0; display: flex; flex-direction: column;
  background: var(--ink-panel);
}
.ink-editor-pane { border-right: 1px solid var(--ink-border); background: var(--ink-panel); }
.ink-view-split .ink-editor-pane { border-right: 1px solid var(--ink-border); }
.ink-pane-label {
  padding: 8px 20px; font-size: 10px; font-weight: 600;
  letter-spacing: 0.12em; color: var(--ink-text-3);
  border-bottom: 1px solid var(--ink-border);
  background: var(--ink-panel);
}

/* Textarea */
.ink-textarea {
  flex: 1; width: 100%; padding: 24px 32px; box-sizing: border-box;
  background: transparent; border: 0; outline: 0; resize: none;
  color: var(--ink-text); font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px; line-height: 1.7; tab-size: 2;
  caret-color: var(--ink-accent);
}
.ink-textarea::placeholder { color: var(--ink-text-3); }

/* Preview */
.ink-preview-pane { background: var(--ink-panel); overflow: hidden; }
.ink-prose {
  padding: 32px 48px; overflow-y: auto; flex: 1;
  max-width: 820px; margin: 0 auto; width: 100%;
  box-sizing: border-box;
  font-family: 'Charter', 'Iowan Old Style', Georgia, serif;
  font-size: 17px; line-height: 1.7; color: var(--ink-text);
}
.ink-prose h1, .ink-prose h2, .ink-prose h3, .ink-prose h4, .ink-prose h5, .ink-prose h6 {
  font-family: 'Inter', -apple-system, sans-serif;
  letter-spacing: -0.02em; line-height: 1.25; margin: 1.6em 0 0.6em;
  scroll-margin-top: 20px;
}
.ink-prose h1 {
  font-size: 2.1em; font-weight: 800;
  border-bottom: 1px solid var(--ink-border); padding-bottom: .3em;
  background: var(--ink-gradient);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ink-prose h2 { font-size: 1.55em; font-weight: 700; color: var(--ink-accent); }
.ink-prose h3 { font-size: 1.25em; font-weight: 650; color: var(--ink-accent-3); }
.ink-prose h4 { font-size: 1.05em; font-weight: 600; color: var(--ink-accent-2); }
.ink-prose p { margin: 0.85em 0; }
.ink-prose a { color: var(--ink-accent); text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 1px; }
.ink-prose a:hover { text-decoration-thickness: 2px; }
.ink-prose strong { font-weight: 650; color: var(--ink-text); }
.ink-prose em { font-style: italic; }
.ink-prose code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.88em; padding: 0.15em 0.4em; border-radius: 4px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  color: var(--ink-accent);
}
.ink-prose pre {
  margin: 1.2em 0; padding: 16px 20px; border-radius: 10px;
  background: #0d1117; color: #e6edf3; overflow-x: auto;
  border: 1px solid var(--ink-border);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13.5px; line-height: 1.6;
}
.ink-prose pre code { background: transparent; border: 0; padding: 0; color: inherit; font-size: inherit; }
.ink-prose blockquote {
  margin: 1.2em 0; padding: 4px 20px;
  border-left: 3px solid var(--ink-accent);
  color: var(--ink-text-2); font-style: italic;
  background: var(--ink-panel-2); border-radius: 0 8px 8px 0;
}
.ink-prose ul, .ink-prose ol { padding-left: 1.5em; margin: 0.85em 0; }
.ink-prose li { margin: 0.3em 0; }
.ink-prose li.task-list-item { list-style: none; margin-left: -1.4em; }
.ink-prose li.task-list-item input { margin-right: 0.5em; }
.ink-prose hr { margin: 2em 0; border: 0; border-top: 1px solid var(--ink-border); }
.ink-prose table {
  border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em;
  font-family: 'Inter', sans-serif;
}
.ink-prose th, .ink-prose td {
  border: 1px solid var(--ink-border); padding: 8px 12px; text-align: left;
}
.ink-prose th { background: var(--ink-panel-2); font-weight: 600; }
.ink-prose img { max-width: 100%; border-radius: 8px; margin: 1em 0; }

/* Footer */
.ink-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 20px; background: var(--ink-panel);
  border-top: 1px solid var(--ink-border);
  font-size: 12px; color: var(--ink-text-2);
}
.ink-stats { display: flex; gap: 18px; }
.ink-stats b { color: var(--ink-text); font-weight: 600; }
.ink-save { display: flex; align-items: center; gap: 8px; }
.ink-dot { width: 7px; height: 7px; border-radius: 50%; }
.ink-dot.saved { background: var(--ink-accent-2); box-shadow: 0 0 0 3px rgba(107, 142, 90, 0.15); }
.ink-dot.saving { background: #d4a54e; animation: ink-pulse 1.2s ease-in-out infinite; }
@keyframes ink-pulse { 50% { opacity: 0.5; } }

/* Scrollbars */
.ink-prose::-webkit-scrollbar, .ink-textarea::-webkit-scrollbar, .ink-outline-list::-webkit-scrollbar { width: 10px; height: 10px; }
.ink-prose::-webkit-scrollbar-thumb, .ink-textarea::-webkit-scrollbar-thumb, .ink-outline-list::-webkit-scrollbar-thumb {
  background: var(--ink-border-strong); border-radius: 6px; border: 2px solid var(--ink-panel);
}
.ink-prose::-webkit-scrollbar-track, .ink-textarea::-webkit-scrollbar-track { background: transparent; }

/* Responsive */
@media (max-width: 900px) {
  .ink-header {
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    grid-template-rows: auto auto;
    gap: 10px;
    padding: 10px 14px;
    max-width: 100vw;
    overflow: hidden;
  }
  .ink-right {
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }
  .ink-right::-webkit-scrollbar { display: none; }
  .ink-menu { flex-shrink: 0; flex-wrap: nowrap; }
  .ink-view-toggle { flex-shrink: 0; }
  .ink-icon-btn, .ink-view-toggle button { flex-shrink: 0; }
  .ink-brand { gap: 10px; }
  .ink-logo { width: 32px; height: 32px; }
  .ink-toolbar {
    grid-column: 1 / -1;
    order: 3;
    padding-bottom: 2px;
    margin: 0 -14px;
    padding-left: 14px;
    padding-right: 14px;
    -webkit-overflow-scrolling: touch;
  }
  .ink-tool-group + .ink-tool-group { margin-left: 6px; }
  .ink-tool-btn { width: 36px; height: 36px; }
  .ink-body { grid-template-columns: 1fr; }
  .ink-outline {
    position: fixed; inset: 0; z-index: 45; width: min(320px, 88vw) !important;
    background: color-mix(in oklab, var(--ink-panel) 97%, transparent);
    backdrop-filter: blur(12px);
    transform: translateX(0); transition: transform 220ms ease;
    padding-top: env(safe-area-inset-top);
    box-shadow: 0 20px 60px -20px rgba(0,0,0,0.35);
    border-right: 1px solid var(--ink-border);
  }
  .ink-outline.collapsed { transform: translateX(-100%); box-shadow: none; }
  .ink-outline-backdrop {
    position: fixed; inset: 0; z-index: 44;
    background: rgba(0,0,0,0.35);
    backdrop-filter: blur(2px);
    animation: ink-fade-in 180ms ease;
  }
  @keyframes ink-fade-in { from { opacity: 0 } to { opacity: 1 } }
  /* Floating toggle when outline is closed on mobile */
  .ink-outline.collapsed .ink-outline-toggle {
    position: fixed; top: calc(env(safe-area-inset-top) + 10px); left: 10px; z-index: 46;
    background: var(--ink-panel); border: 1px solid var(--ink-border);
    box-shadow: 0 4px 14px -6px rgba(0,0,0,0.25);
  }
  .ink-view-split { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .ink-view-split .ink-editor-pane { border-right: 0; border-bottom: 1px solid var(--ink-border); }
  .ink-pane-label { padding: 6px 16px; }
  .ink-prose { padding: 20px 18px; font-size: 16px; max-width: 100%; }
  .ink-prose h1 { font-size: 1.7em; }
  .ink-prose h2 { font-size: 1.35em; }
  .ink-prose h3 { font-size: 1.15em; }
  .ink-prose pre { padding: 12px 14px; font-size: 12.5px; border-radius: 8px; }
  .ink-prose table { display: block; overflow-x: auto; white-space: nowrap; }
  .ink-textarea { padding: 16px 18px; font-size: 15px; }
  .ink-footer { padding: 8px 14px; font-size: 11px; flex-wrap: wrap; gap: 8px; }
  .ink-stats { gap: 12px; flex-wrap: wrap; }
  .ink-brand-sub { display: none; }
  .ink-view-toggle button span,
  .ink-view-toggle button svg + * { display: none; }
  .ink-view-toggle button { padding: 6px 8px; }
  .ink-modal-backdrop { padding-top: 6vh; align-items: stretch; }
  .ink-modal, .ink-cmd { width: 96vw; max-height: 88vh; display: flex; flex-direction: column; }
  .ink-tpl-grid { grid-template-columns: 1fr; padding: 12px; }
  .ink-find-panel { top: 8px; }
  .ink-icon-btn { width: 38px; height: 38px; }
}

@media (max-width: 520px) {
  .ink-brand-name { font-size: 14px; }
  .ink-right { gap: 6px; }
  .ink-menu { gap: 2px; }
  .ink-icon-btn { width: 36px; height: 36px; border-radius: 7px; }
  .ink-prose { padding: 16px 14px; font-size: 15.5px; line-height: 1.65; }
  .ink-prose h1 { font-size: 1.5em; }
  .ink-textarea { padding: 14px; font-size: 15px; line-height: 1.65; }
  .ink-footer-right { width: 100%; justify-content: space-between; }
  .ink-cheat-row { font-size: 12px; }
}

/* Break long tokens so text can't overflow on narrow screens */
.ink-prose p, .ink-prose li, .ink-prose h1, .ink-prose h2, .ink-prose h3, .ink-prose h4 {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Respect iOS safe area */
.ink-root { padding-bottom: env(safe-area-inset-bottom); }

/* Larger tap targets in general on touch */
@media (hover: none) and (pointer: coarse) {
  .ink-tool-btn, .ink-icon-btn { min-width: 40px; min-height: 40px; }
  .ink-cmd-item, .ink-outline-item { padding-top: 10px; padding-bottom: 10px; }
  .ink-code-copy { opacity: 1; }
}

/* Icon button "on" state */
.ink-icon-btn.on { color: var(--ink-accent); border-color: var(--ink-accent); background: var(--ink-panel); }

/* Focus mode: hide chrome, keep editor */
.ink-root.focus-mode .ink-header,
.ink-root.focus-mode .ink-outline,
.ink-root.focus-mode .ink-pane-label { display: none; }
.ink-root.focus-mode .ink-body { grid-template-columns: 1fr; }
.ink-root.focus-mode .ink-footer { opacity: 0.4; transition: opacity 200ms ease; }
.ink-root.focus-mode .ink-footer:hover { opacity: 1; }
.ink-root.focus-mode .ink-textarea { padding: 60px max(48px, calc(50vw - 380px)); font-size: 15px; line-height: 1.8; }
.ink-root.focus-mode .ink-prose { padding: 60px 48px; }

/* Find & Replace panel */
.ink-find-panel {
  position: fixed; top: 12px; right: 20px; z-index: 40;
  background: var(--ink-panel); border: 1px solid var(--ink-border-strong);
  border-radius: 12px; box-shadow: var(--ink-shadow);
  padding: 8px; display: flex; flex-direction: column; gap: 6px;
  min-width: 380px;
  animation: ink-slide-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes ink-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.ink-find-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px; }
.ink-find-row > svg { color: var(--ink-text-3); flex-shrink: 0; }
.ink-find-input {
  flex: 1; background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  border-radius: 6px; padding: 6px 10px; font-size: 13px; color: var(--ink-text);
  outline: none; font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.ink-find-input:focus { border-color: var(--ink-accent); }
.ink-find-count {
  font-size: 11px; color: var(--ink-text-3); font-variant-numeric: tabular-nums;
  min-width: 42px; text-align: right; font-family: ui-monospace, monospace;
}
.ink-find-btn {
  height: 28px; min-width: 28px; padding: 0 6px;
  border-radius: 6px; border: 1px solid var(--ink-border);
  background: var(--ink-panel-2); color: var(--ink-text-2);
  font-size: 12px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 120ms ease;
}
.ink-find-btn:hover:not(:disabled) { color: var(--ink-text); border-color: var(--ink-border-strong); }
.ink-find-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ink-find-btn.on { background: var(--ink-accent); color: white; border-color: var(--ink-accent); }
.ink-find-btn.wide { padding: 0 12px; }

/* Footer + Goal widget */
.ink-footer-right { display: flex; align-items: center; gap: 16px; }
.ink-goal { position: relative; }
.ink-goal-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 6px; border-radius: 999px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  color: var(--ink-text-2); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 120ms ease;
  font-variant-numeric: tabular-nums;
}
.ink-goal-btn:hover { color: var(--ink-text); border-color: var(--ink-border-strong); }
.ink-goal-sub { color: var(--ink-text-3); font-family: ui-monospace, monospace; font-size: 11px; }
.ink-goal-pop {
  position: absolute; bottom: calc(100% + 8px); right: 0;
  background: var(--ink-panel); border: 1px solid var(--ink-border-strong);
  border-radius: 10px; box-shadow: var(--ink-shadow);
  padding: 12px; min-width: 220px; z-index: 30;
  animation: ink-slide-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ink-goal-pop label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ink-text-3); display: block; margin-bottom: 6px;
}
.ink-goal-row { display: flex; gap: 6px; margin-bottom: 8px; }
.ink-goal-row input {
  flex: 1; background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  border-radius: 6px; padding: 6px 10px; font-size: 13px; color: var(--ink-text);
  outline: none; font-family: ui-monospace, monospace;
}
.ink-goal-row input:focus { border-color: var(--ink-accent); }
.ink-goal-row button {
  padding: 6px 12px; border-radius: 6px; border: 0;
  background: var(--ink-accent); color: white; font-size: 12px;
  font-weight: 600; cursor: pointer;
}
.ink-goal-presets { display: flex; flex-wrap: wrap; gap: 4px; }
.ink-goal-presets button {
  padding: 4px 10px; border-radius: 6px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  color: var(--ink-text-2); font-size: 11px; font-weight: 500; cursor: pointer;
  font-family: ui-monospace, monospace;
}
.ink-goal-presets button:hover { color: var(--ink-text); }
.ink-goal-presets button.clear { color: var(--ink-accent); margin-left: auto; }

@media (max-width: 900px) {
  .ink-find-panel { left: 12px; right: 12px; min-width: 0; }
  .ink-footer-right { gap: 8px; }
}

/* Modals, palette, templates, share toast, mermaid, math */
.ink-modal-backdrop {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
  display: grid; place-items: start center; padding-top: 12vh;
  animation: ink-fade 140ms ease;
}
@keyframes ink-fade { from { opacity: 0; } to { opacity: 1; } }
.ink-modal, .ink-cmd {
  background: var(--ink-panel); border: 1px solid var(--ink-border-strong);
  border-radius: 14px; box-shadow: var(--ink-shadow);
  width: min(640px, 92vw); overflow: hidden;
}
.ink-modal-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px; border-bottom: 1px solid var(--ink-border);
  font-weight: 600; font-size: 14px;
}
.ink-modal-close {
  margin-left: auto; background: transparent; border: 0; color: var(--ink-text-2);
  cursor: pointer; padding: 4px; border-radius: 6px; display: grid; place-items: center;
}
.ink-modal-close:hover { background: var(--ink-panel-2); color: var(--ink-text); }
.ink-tpl-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px;
}
.ink-tpl-card {
  display: flex; flex-direction: column; gap: 4px; text-align: left;
  padding: 14px; border-radius: 10px; cursor: pointer;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border); color: var(--ink-text);
  transition: all 120ms ease;
}
.ink-tpl-card:hover { border-color: var(--ink-accent); transform: translateY(-1px); }
.ink-tpl-icon { font-size: 22px; }
.ink-tpl-name { font-weight: 600; font-size: 13px; }
.ink-tpl-preview { font-size: 11px; color: var(--ink-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ink-cmd-input-row {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; border-bottom: 1px solid var(--ink-border);
  color: var(--ink-text-2);
}
.ink-cmd-input-row input {
  flex: 1; background: transparent; border: 0; outline: 0;
  color: var(--ink-text); font-size: 14px;
}
.ink-cmd-kbd {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  color: var(--ink-text-3); font-family: ui-monospace, monospace;
}
.ink-cmd-list { max-height: 55vh; overflow-y: auto; padding: 6px; }
.ink-cmd-empty { padding: 16px; text-align: center; color: var(--ink-text-3); font-size: 13px; }
.ink-cmd-item {
  width: 100%; text-align: left; padding: 8px 12px; border: 0; background: transparent;
  color: var(--ink-text); font-size: 13px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between;
}
.ink-cmd-item.active { background: var(--ink-panel-2); }
.ink-cmd-hint { font-size: 10px; color: var(--ink-text-3); font-family: ui-monospace, monospace; }
.ink-toast {
  position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
  z-index: 60; padding: 10px 16px; border-radius: 8px;
  background: var(--ink-text); color: var(--ink-bg); font-size: 13px;
  box-shadow: var(--ink-shadow); animation: ink-fade 160ms ease;
}
.ink-mermaid {
  margin: 1.2em 0; padding: 16px; border-radius: 10px;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
  overflow-x: auto; text-align: center;
}
.ink-mermaid svg { max-width: 100%; height: auto; }
.ink-mermaid-err { color: #e07a55; font-family: ui-monospace, monospace; font-size: 12px; }
.ink-math-block { margin: 1.2em 0; padding: 12px; overflow-x: auto; text-align: center; }
.ink-math-inline { padding: 0 2px; }

/* Copy button on code blocks */
.ink-code-copy {
  position: absolute; top: 8px; right: 8px;
  font-size: 11px; font-family: ui-monospace, monospace;
  padding: 4px 8px; border-radius: 6px; cursor: pointer;
  background: rgba(255,255,255,0.06); color: #e6edf3;
  border: 1px solid rgba(255,255,255,0.12);
  opacity: 0; transition: opacity 120ms ease, background 120ms ease;
}
.ink-prose pre:hover .ink-code-copy { opacity: 1; }
.ink-code-copy:hover { background: rgba(255,255,255,0.14); }
.ink-code-copy.copied { background: var(--ink-accent-2); color: #fff; border-color: transparent; opacity: 1; }

/* Snapshots */
.ink-snap-list { max-height: 60vh; overflow-y: auto; padding: 8px; }
.ink-snap-empty { padding: 24px; text-align: center; color: var(--ink-text-3); font-size: 13px; }
.ink-snap-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px; margin: 4px 0;
  background: var(--ink-panel-2); border: 1px solid var(--ink-border);
}
.ink-snap-info { flex: 1; min-width: 0; }
.ink-snap-name { font-size: 13px; font-weight: 600; color: var(--ink-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ink-snap-meta { font-size: 11px; color: var(--ink-text-3); margin-top: 2px; }
.ink-snap-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer;
  background: var(--ink-panel); color: var(--ink-text-2);
  border: 1px solid var(--ink-border);
}
.ink-snap-btn:hover { color: var(--ink-text); border-color: var(--ink-border-strong); }
.ink-snap-btn.danger:hover { color: #e07a55; border-color: #e07a55; }

/* Cheatsheet */
.ink-cheat { padding: 8px 16px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
.ink-cheat-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 4px; border-bottom: 1px dashed var(--ink-border);
  font-size: 13px; color: var(--ink-text);
}
.ink-cheat-keys {
  font-family: ui-monospace, monospace; font-size: 11px;
  padding: 3px 8px; border-radius: 5px;
  background: var(--ink-panel-2); color: var(--ink-text-2);
  border: 1px solid var(--ink-border);
}
@media (max-width: 640px) { .ink-cheat { grid-template-columns: 1fr; } }
`;
