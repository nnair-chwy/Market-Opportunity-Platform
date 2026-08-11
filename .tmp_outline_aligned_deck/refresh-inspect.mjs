import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const source = "/Users/nnair/Documents/Market Opportunity Platform/Market_Opportunity_Platform_Discovery_Journey_and_Future.pptx";
const output = "/Users/nnair/Documents/Market Opportunity Platform/.tmp_outline_aligned_deck/template-inspect/template-inspect.ndjson";

const presentation = await PresentationFile.importPptx(await FileBlob.load(source));
const snapshot = await presentation.inspect({
  kind: "slide,textbox,shape,image,table,chart",
  maxChars: 100000,
});
await fs.writeFile(output, snapshot.ndjson);
