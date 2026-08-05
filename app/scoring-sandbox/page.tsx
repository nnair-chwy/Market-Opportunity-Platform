import { redirect } from "next/navigation";

export default function ScoringSandboxPage() {
  redirect("/?workspace=locations&view=sandbox");
}
