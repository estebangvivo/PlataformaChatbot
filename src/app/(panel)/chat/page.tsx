import { Suspense } from "react";
import { TeamChatView } from "@/components/team-chat-view";

export default function ChatInternoPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense>
        <TeamChatView />
      </Suspense>
    </div>
  );
}
