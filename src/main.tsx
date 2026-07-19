import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MarkdownEditor from "@/components/MarkdownEditor";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MarkdownEditor />
  </StrictMode>,
);
