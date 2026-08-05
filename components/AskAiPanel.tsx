"use client";

import { FormEvent, useState } from "react";
import type {
  AskAiAnswerItem,
  AskAiContext,
  AskAiResponse,
  AskAiResponseMode,
  AskAiUsage,
} from "@/lib/ai/insights";

export type { AskAiContext, AskAiInsight } from "@/lib/ai/insights";

export type AskAiPanelProps = {
  context: AskAiContext | null;
  emptyTitle: string;
  emptyMessage: string;
  compact?: boolean;
  className?: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  mode?: AskAiResponseMode;
  items?: AskAiAnswerItem[];
  limitations?: string[];
  model?: string;
  usage?: AskAiUsage | null;
  isError?: boolean;
};

export function AskAiPanel({
  context,
  emptyTitle,
  emptyMessage,
  compact = false,
  className,
}: AskAiPanelProps) {
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [showContext, setShowContext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const conversationActive = chat.length > 0 && !showContext;
  const classes = [
    "ask-ai-panel",
    compact ? "compact" : "",
    conversationActive ? "conversation-active" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!context || !text || isLoading) return;
    setChat((messages) => [
      ...messages,
      { role: "user", text },
    ]);
    setShowContext(false);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, context }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (
        !response.ok ||
        typeof payload !== "object" ||
        payload === null ||
        !("answer" in payload)
      ) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof payload.message === "string"
            ? payload.message
            : "Ask AI could not answer this question.";
        throw new Error(message);
      }

      const result = payload as AskAiResponse;
      setChat((messages) => [
        ...messages,
        {
          role: "assistant",
          text: result.answer,
          mode: result.mode,
          items: result.items,
          limitations: result.limitations,
          model: result.metadata.model,
          usage: result.metadata.usage,
        },
      ]);
    } catch (error) {
      setChat((messages) => [
        ...messages,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Ask AI could not answer this question.",
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const suggestions =
    context?.suggestedQuestions ??
    [
      "What stands out?",
      "What needs review?",
      "What should we investigate next?",
    ];

  return (
    <aside className={classes} aria-labelledby={`ask-ai-${context?.id ?? "empty"}`}>
      <div className="ask-ai-heading">
        <div className="ask-ai-orb" aria-hidden="true">
          ✦
        </div>
        <div>
          <p className="ask-ai-eyebrow">Ask AI</p>
          <h2 id={`ask-ai-${context?.id ?? "empty"}`}>
            {context ? context.title : emptyTitle}
          </h2>
          <p>{context ? context.subtitle : emptyMessage}</p>
        </div>
        <div className="ask-ai-heading-actions">
          <span className="draft-badge">Draft for review</span>
          {chat.length ? (
            <button
              className="ask-ai-view-toggle"
              type="button"
              onClick={() => setShowContext((current) => !current)}
            >
              {showContext ? "Return to chat" : "View context"}
            </button>
          ) : null}
        </div>
      </div>

      {context ? (
        <>
          {conversationActive ? (
            <div className="ask-ai-chat" aria-live="polite">
              {chat.map((message, index) => (
                <div
                  className={`ask-ai-message ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <span aria-hidden="true">
                    {message.role === "assistant" ? "✦" : "You"}
                  </span>
                  <div
                    className={`ask-ai-message-body ${
                      message.isError ? "error" : ""
                    }`}
                  >
                    {message.items?.length ? (
                      message.mode === "qa_list" ? (
                        <ol className="ask-ai-answer-list">
                          {message.items.map((item, itemIndex) => (
                            <li key={`${item.question ?? "answer"}-${itemIndex}`}>
                              {item.question ? <strong>{item.question}</strong> : null}
                              <p>{item.answer}</p>
                              <small>
                                {item.evidenceStatus}
                                {item.sourceIds.length
                                  ? ` · ${item.sourceIds.join(" · ")}`
                                  : " · No source loaded"}
                              </small>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="ask-ai-answer-items">
                          {message.items.map((item, itemIndex) => (
                            <article key={`${item.question ?? "answer"}-${itemIndex}`}>
                              {item.question ? <strong>{item.question}</strong> : null}
                              <p>{item.answer}</p>
                              <small>
                                {item.evidenceStatus}
                                {item.sourceIds.length
                                  ? ` · ${item.sourceIds.join(" · ")}`
                                  : " · No source loaded"}
                              </small>
                            </article>
                          ))}
                        </div>
                      )
                    ) : (
                      <p>{message.text}</p>
                    )}
                    {message.limitations?.length ? (
                      <small>
                        Limitation: {message.limitations.join(" ")}
                      </small>
                    ) : null}
                    {message.role === "assistant" && !message.isError ? (
                      <small>
                        Draft for review
                        {message.model ? ` · ${message.model}` : ""}
                        {message.usage
                          ? ` · ${message.usage.inputTokens} input + ${message.usage.outputTokens} output tokens`
                          : ""}
                      </small>
                    ) : null}
                  </div>
                </div>
              ))}
              {isLoading ? (
                <div className="ask-ai-message">
                  <span aria-hidden="true">✦</span>
                  <div className="ask-ai-message-body loading">
                    <p>Reviewing the structured evidence…</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="ask-ai-overview">
                <span aria-hidden="true">✦</span>
                <p>{context.overview}</p>
              </div>

              <div className="ask-ai-insights" aria-label="AI insight starters">
                {context.insights.slice(0, compact ? 3 : 4).map((insight) => (
                  <article
                    className={`ask-ai-insight ${insight.tone ?? "neutral"}`}
                    key={`${insight.title}-${insight.sourceIds.join("-")}`}
                  >
                    <div>
                      <strong>{insight.title}</strong>
                      <span
                        className={`evidence-status ${insight.status.toLowerCase()}`}
                      >
                        {insight.status}
                      </span>
                    </div>
                    <p>{insight.detail}</p>
                    <small>
                      {insight.sourceIds.length
                        ? insight.sourceIds.join(" · ")
                        : "No source loaded"}
                    </small>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="ask-ai-prompts">
            {suggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="ask-ai-form" onSubmit={ask}>
            <input
              aria-label={`Ask AI about ${context.title}`}
              placeholder="Ask about signals, risks, evidence, or next steps"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              aria-label="Send question"
              disabled={isLoading || !question.trim()}
            >
              ↑
            </button>
          </form>

          <p className="ask-ai-boundary">
            AI explains source-linked structured evidence. It does not calculate
            scores, fill missing values, change settings, or make the final site
            decision.
          </p>
        </>
      ) : (
        <div className="ask-ai-empty">
          <span aria-hidden="true">⌖</span>
          <p>{emptyMessage}</p>
        </div>
      )}
    </aside>
  );
}
