try {
  await import("./remake-deck.mjs");
} catch (error) {
  console.log(`${error?.name ?? "Error"}: ${error?.message ?? String(error)}`);
  if (error?.stack) console.log(error.stack.split(/\r?\n/).slice(0, 12).join("\n"));
  process.exitCode = 1;
}
