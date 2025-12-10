import { getFaqs } from "../actions/faqs";
import { FaqsClient } from "@/components/faqs-client";

export default async function FaqsPage() {
  const faqs = await getFaqs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">FAQs</h1>
      </div>
      <FaqsClient initialFaqs={faqs} />
    </div>
  );
}
