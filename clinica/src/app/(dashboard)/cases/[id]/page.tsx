import { CaseDetailView } from "@/components/CaseDetailView";

type Params = { params: Promise<{ id: string }> };

export default async function CasePage({ params }: Params) {
  const { id } = await params;
  return <CaseDetailView caseId={id} />;
}
