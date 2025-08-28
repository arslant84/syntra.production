import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ claimId: string }>;
}

export default async function ClaimRedirect({ params }: Props) {
  const { claimId } = await params;
  redirect(`/claims/view/${claimId}`);
}