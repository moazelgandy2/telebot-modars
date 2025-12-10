import { getContactData } from "../actions/contact";
import { ContactClient } from "@/components/contact-client";

export default async function ContactPage() {
  const contact = await getContactData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Contact Information</h1>
      </div>
      <ContactClient initialContact={contact} />
    </div>
  );
}
