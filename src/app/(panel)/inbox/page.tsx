import { Suspense } from "react";
import { InboxBoard } from "@/components/inbox-board";

export default function InboxPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense>
        <InboxBoard />
      </Suspense>
    </div>
  );
}
