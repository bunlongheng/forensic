// Shared sharp loader for the image-processing maintenance scripts (gen-icons,
// shrink-boards). sharp is not a repo dependency (dev-only tooling): prefer a
// local install, otherwise exit with an install hint.
export async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    console.error("sharp not found: run `npm i -D sharp` in this repo.");
    process.exit(1);
  }
}
