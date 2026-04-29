import { useParams, useLocation } from "wouter";
import { DmView } from "@/components/dm-view";
import { useDocumentMeta } from "@/hooks/use-document-meta";

export default function DmPage() {
  const params = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  useDocumentMeta({
    title: "Messages",
    description: "Direct messages on Vextorn.",
    noIndex: true,
  });

  if (!params.userId) {
    navigate("/");
    return null;
  }

  return (
    <DmView
      otherUserId={params.userId}
      onBack={() => navigate("/")}
    />
  );
}
