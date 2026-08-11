import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const p = await PresentationFile.importPptx(await FileBlob.load("/Users/nnair/Documents/Market Opportunity Platform/.tmp_outline_aligned_deck/template-starter.pptx"));
const slide = p.slides.items[1];
for (const [i, shape] of slide.shapes.items.entries()) {
  console.log(i, typeof shape.text, shape.text?.constructor?.name, Object.keys(shape).slice(0, 10), String(shape.text).slice(0, 120));
}
