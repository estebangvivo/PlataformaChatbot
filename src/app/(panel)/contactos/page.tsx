import { Suspense } from "react";
import { ContactsView } from "@/components/contacts-view";

export default function ContactosPage() {
  return (
    <Suspense>
      <ContactsView />
    </Suspense>
  );
}
