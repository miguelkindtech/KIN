import B2AClient from "../B2AClient";

export default function B2ADetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <B2AClient defaultId={params.id} />;
}
