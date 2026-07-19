import { createFileRoute } from "@tanstack/react-router";
import MarkdownEditor from "@/components/MarkdownEditor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inkwell — Markdown Studio" },
      { name: "description", content: "A refined, distraction-free markdown editor with live preview, import/export, syntax highlighting, and autosave. Runs entirely in your browser." },
      { property: "og:title", content: "Inkwell — Markdown Studio" },
      { property: "og:description", content: "A refined, distraction-free markdown editor with live preview and export to Markdown, HTML, and PDF." },
    ],
  }),
  component: Index,
});

function Index() {
  return <MarkdownEditor />;
}
