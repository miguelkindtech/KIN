import VerticalsClient from "../VerticalsClient";

export default function VerticalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <VerticalsClient defaultId={params.id} />;
}
