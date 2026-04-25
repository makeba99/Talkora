import { useParams, useLocation } from "wouter";
import { DmView } from "@/components/dm-view";

export default function DmPage() {
  const params = useParams<{ userId: string }>();
  const [, navigate] = useLocation();

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
