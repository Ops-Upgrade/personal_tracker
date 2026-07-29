import BankDetailView from "@/components/vault/banks/BankDetailView";

export default async function BankDetailPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const { bankId } = await params;
  return <BankDetailView bankId={bankId} />;
}
