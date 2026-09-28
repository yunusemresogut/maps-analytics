import { redirect } from "next/navigation";

export default async function ContractDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/contracts/${id}/edit`);
}
