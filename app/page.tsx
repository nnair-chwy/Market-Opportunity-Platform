import { DecisionWorkflowApp } from "@/components/decision-workflow/DecisionWorkflowApp";
import { requireChatGPTUser } from "@/app/chatgpt-auth";

export default async function Home() {
  if (process.env.REQUIRE_AUTHENTICATED_VIEWER === "true") {
    await requireChatGPTUser("/");
  }
  return <DecisionWorkflowApp />;
}
