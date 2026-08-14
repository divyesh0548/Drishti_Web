"use client";

import { useMemo, useState } from "react";

import type { WorkspaceContextPayload } from "@/components/layout/topbar";
import { Bot, SendHorizonal, Sparkles, X } from "lucide-react";
import { PortalButton, PortalIconButton } from "@/components/ui/portal-button";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type KnowledgeEntry = {
  question: string;
  answer: (workspace: WorkspaceContextPayload | null) => string;
  tags: string[];
};

const knowledgeBase: KnowledgeEntry[] = [
  {
    question: "What can you help me with?",
    answer: (workspace) =>
      `I can help with trial balance imports, mapping review, fixed assets, statement outputs, and report checks for ${workspace?.company?.name ?? "your workspace"}.`,
    tags: ["help", "support", "what", "can", "you", "do"],
  },
  {
    question: "How do I import a trial balance?",
    answer: () =>
      "Open Imports from the left navigation, upload the workbook, review the preview rows, validate flags, and then create or update the version workspace.",
    tags: ["import", "trial", "balance", "upload", "workbook"],
  },
  {
    question: "Where should I review ledger mapping?",
    answer: () =>
      "Open Mapping from the navigation. That workspace is where you review classifications, confidence, note buckets, and any manual overrides.",
    tags: ["mapping", "ledger", "classify", "classification", "override"],
  },
  {
    question: "What does the review queue mean?",
    answer: () =>
      "The review queue highlights issues that need attention before finalizing statements, such as validation exceptions, unclassified rows, or balancing checks.",
    tags: ["review", "queue", "issues", "validation", "flags"],
  },
  {
    question: "Where can I find fixed assets?",
    answer: () =>
      "Open Fixed Assets from the navigation. That premium module handles FAR uploads, depreciation schedules, audit-ready reports, and integration outputs.",
    tags: ["fixed", "assets", "far", "depreciation"],
  },
  {
    question: "How do I export statements or reports?",
    answer: () =>
      "Use Financial Statements for statement viewing and Reports for export delivery. Those screens provide workbook, PDF, and report-readiness actions.",
    tags: ["export", "reports", "statements", "pdf", "excel"],
  },
  {
    question: "What is the active company and version?",
    answer: (workspace) =>
      workspace?.company && workspace.currentVersion
        ? `${workspace.company.name} is currently selected with ${workspace.currentVersion.label} for financial year ${workspace.currentVersion.financialYear}.`
        : "The current company and version will appear here once a company workspace is available.",
    tags: ["company", "version", "financial", "year", "active"],
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function findBestReply(input: string) {
  const queryTokens = normalize(input).split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    return knowledgeBase[0];
  }

  const bestMatch = [...knowledgeBase]
    .map((entry) => {
      const questionText = normalize(entry.question);
      const score = queryTokens.reduce((total, token) => {
        const tokenHit = questionText.includes(token) || entry.tags.some((tag) => tag.includes(token));
        return total + (tokenHit ? 1 : 0);
      }, 0);

      return { entry, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  return bestMatch?.score ? bestMatch.entry : null;
}

function buildWelcomeMessage(workspace: WorkspaceContextPayload | null) {
  if (!workspace) {
    return "Ask about imports, mapping, statements, reports, or fixed assets. I will reply using the built-in guidance available in the portal.";
  }

  if (!workspace.company || !workspace.currentVersion) {
    return workspace.company
      ? "Ask about imports, mapping, statements, reports, or fixed assets. Upload a trial balance in Imports to create the first version."
      : "Ask about imports, mapping, statements, reports, or fixed assets. Create a company from Administration to load a workspace.";
  }

  return `Ask about ${workspace.company.name}, ${workspace.currentVersion.label}, imports, mapping, reports, or fixed assets. I will reply using the built-in guidance available in the portal.`;
}

export function TopbarAiDrawer({ workspace = null }: { workspace?: WorkspaceContextPayload | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const suggestedQuestions = useMemo(() => knowledgeBase.slice(0, 5).map((entry) => entry.question), []);

  const submitPrompt = (prompt: string) => {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      return;
    }

    const bestReply = findBestReply(nextPrompt);
    const response =
      bestReply?.answer(workspace) ??
      "I can answer predefined questions about imports, mapping, review queues, fixed assets, reports, and workspace context. Try one of the suggested prompts below.";

    setMessages((current) => [
      ...current,
      { role: "user", content: nextPrompt },
      { role: "assistant", content: response },
    ]);
    setDraft("");
  };

  return (
    <>
      {!open ? (
        <PortalIconButton
          onClick={() => setOpen(true)}
          aria-label="Open Drishti AI chat"
          sx={{
            position: "fixed",
            bottom: { xs: 20, md: 24 },
            right: { xs: 20, md: 24 },
            left: "auto",
            zIndex: 50,
            height: 56,
            width: 56,
            borderRadius: "9999px",
            borderColor: "rgba(191,219,254,1)",
            background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
            color: "#fff",
            boxShadow: "0 18px 40px rgba(37,99,235,0.35)",
            transition: "transform 150ms ease, box-shadow 150ms ease",
            "&:hover": {
              background: "linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)",
              borderColor: "rgba(191,219,254,1)",
              color: "#fff",
              transform: "translateY(-4px)",
              boxShadow: "0 22px 48px rgba(37,99,235,0.42)",
            },
          }}
        >
          <Bot className="h-5 w-5" />
        </PortalIconButton>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200/70 bg-white/95 p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950/95">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  Chat Assistant
                </div>
                <h3 className="mt-3 font-[var(--font-display)] text-[1.5rem] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                  Drishti AI
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Ask built-in workflow questions and get quick guidance from the portal assistant.
                </p>
              </div>
              <PortalIconButton
                onClick={() => setOpen(false)}
                aria-label="Close Drishti AI chat"
                sx={{ height: 40, width: 40, flexShrink: 0 }}
              >
                <X className="h-4 w-4" />
              </PortalIconButton>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto rounded-[1.4rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/55">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/12 dark:to-indigo-500/12 dark:text-blue-300">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div className="rounded-[1.1rem] bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-200">
                    {buildWelcomeMessage(workspace)}
                  </div>
                </div>

                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn("flex gap-3", message.role === "user" ? "justify-end" : "")}
                  >
                    {message.role === "assistant" ? (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/12 dark:to-indigo-500/12 dark:text-blue-300">
                        <Bot className="h-4.5 w-4.5" />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[1.1rem] px-4 py-3 text-sm leading-6 shadow-sm",
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200",
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <PortalButton
                    key={question}
                    variant="tab"
                    onClick={() => submitPrompt(question)}
                    sx={{ textTransform: "none", fontWeight: 400 }}
                  >
                    {question}
                  </PortalButton>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="relative">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitPrompt(draft);
                    }
                  }}
                  className="field-input field-input-icon-right"
                  placeholder="Ask a predefined workflow question"
                />
                <PortalIconButton
                  onClick={() => submitPrompt(draft)}
                  aria-label="Send message"
                  sx={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2,
                    height: 36,
                    width: 36,
                    borderRadius: "0.75rem",
                    borderColor: "transparent",
                    bgcolor: "primary.main",
                    color: "#eff6ff",
                    "&:hover": {
                      bgcolor: "primary.dark",
                      borderColor: "transparent",
                      color: "#eff6ff",
                    },
                  }}
                >
                  <SendHorizonal className="h-4 w-4" />
                </PortalIconButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
