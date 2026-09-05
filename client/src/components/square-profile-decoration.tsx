import { SQUARE_PROFILE_STYLES, type SquareProfileStyleId } from "@/lib/square-profile-style";

/**
 * Square edge decoration for room/lobby profile cards.
 * CSS-driven — does not sit on the face, does not require VIP overlays.
 */
export function SquareProfileDecoration({
  styleId,
}: {
  styleId: SquareProfileStyleId | string;
}) {
  const known = SQUARE_PROFILE_STYLES.some((s) => s.id === styleId);
  const id = known ? styleId : "none";
  if (id === "none") return null;
  return (
    <>
      <span className="rup__deco" aria-hidden="true" />
      <span className="rup__spark" aria-hidden="true" />
    </>
  );
}
