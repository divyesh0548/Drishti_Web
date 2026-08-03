"use client";

import { useMemo, useState } from "react";

import { PortalButton, PortalIconButton } from "@/components/ui/portal-button";
import type { AiCopilotPrompt } from "@/lib/ai-workflow";
import { Bot, SendHorizonal, Sparkles } from "lucide-react";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function bestMatch(input: string, prompts: AiCopilotPrompt[]) {
  const queryTokens = normalize(input).split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    return prompts[0] ?? null;
  }

  return (
    [...prompts]
      .map((entry) => {
        const promptText = normalize(entry.prompt);
        const score = queryTokens.reduce((total, token) => total + (promptText.includes(token) ? 1 : 0), 0);
        return { entry, score };
      })
      .sort((left, right) => right.score - left.score)[0]?.entry ?? prompts[0] ?? null
  );
}

export function DrishtiAiCopilot({
  prompts,
  title = "Drishti AI",
  description = "Ask natural-language questions about the uploaded financial model.",
}: {
  prompts: AiCopilotPrompt[];
  title?: string;
  description?: string;
}) {
  const [draft, setDraft] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0]?.prompt ?? "");

  const activePrompt = useMemo(
    () => prompts.find((entry) => entry.prompt === selectedPrompt) ?? bestMatch(draft || selectedPrompt, prompts),
    [draft, prompts, selectedPrompt],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          <p className="font-semibold text-slate-950 dark:text-slate-50">{title}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Ask Drishti AI</span>
          <div className="relative">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="field-input field-input-icon-right"
              placeholder="Why has EBITDA reduced this year?"
            />
            <PortalIconButton
              type="button"
              aria-label="Ask Drishti AI"
              onClick={() => {
                const match = bestMatch(draft, prompts);
                if (match) {
                  setSelectedPrompt(match.prompt);
                }
              }}
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
        </label>

        <div className="mt-4 space-y-2">
          {prompts.map((entry) => (
            <PortalButton
              key={entry.prompt}
              variant="tab"
              active={selectedPrompt === entry.prompt}
              type="button"
              fullWidth
              onClick={() => setSelectedPrompt(entry.prompt)}
              sx={{ borderRadius: "1rem", justifyContent: "flex-start", textAlign: "left", textTransform: "none", py: 1.5 }}
            >
              {entry.prompt}
            </PortalButton>
          ))}
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-500/12 dark:to-indigo-500/12 dark:text-blue-300">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-950 dark:text-slate-50">AI Response</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Context-aware narrative grounded in the uploaded financial data.</p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.2rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {activePrompt?.answer ?? "Ask a question or choose one of the suggested prompts to generate a financial explanation."}
        </div>
      </div>
    </div>
  );
}
