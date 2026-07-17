import { Workbench } from "../../../../components/workbench";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  await params;
  return <Workbench />;
}
