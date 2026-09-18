import { edgeSynthesize } from "../server/edge-tts";
import { SesameCsmProvider } from "../server/voice/sesame-csm";

async function main() {
  const sesame = new SesameCsmProvider();
  const skipped = await sesame.synthesize({ text: "Hi", voiceId: "maya" });
  console.log("SESAME_WITHOUT_TOKEN", skipped.ok, skipped.error, skipped.status);

  const edge = await edgeSynthesize("Hello. This is a Vextorn room voice check.", "en-US-AvaNeural");
  if (!edge.ok || !edge.body || edge.body.byteLength < 1000) {
    console.error("EDGE_FAIL", edge.status, edge.error, edge.body?.byteLength);
    process.exit(1);
  }
  console.log("EDGE_OK", edge.contentType, edge.body.byteLength, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
