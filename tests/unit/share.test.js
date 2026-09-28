import { describe, it, expect } from "vitest";
import { shareBoardId, describeBoard } from "../../lib/share.js";

const ID = "11111111-1111-1111-1111-111111111111";

// The one decision middleware.js (Vercel edge) and serve.mjs (local) share:
// which requests on "/" get the OG shell instead of the app.
describe("shareBoardId", () => {
  it("hands a crawler on a share link the board id", () => {
    expect(shareBoardId(`https://forensic-bheng.vercel.app/?id=${ID}`, "Slackbot-LinkExpanding 1.0")).toBe(ID);
    expect(shareBoardId(`/?id=${ID}`, "Mozilla/5.0 (compatible; Twitterbot/1.0)")).toBe(ID);
    expect(shareBoardId(`/?id=${ID}&x=1`, "facebookexternalhit/1.1")).toBe(ID);
  });

  it("lets a person through to the app", () => {
    expect(shareBoardId(`/?id=${ID}`, "Mozilla/5.0 (Macintosh) Safari/605.1.15")).toBeNull();
    expect(shareBoardId(`/?id=${ID}`, undefined)).toBeNull();
  });

  it("ignores a crawler on anything that is not a board link", () => {
    expect(shareBoardId("/", "Slackbot")).toBeNull();
    expect(shareBoardId("/?id=not-a-uuid", "Slackbot")).toBeNull();
    expect(shareBoardId("/?id=%3Cscript%3E", "Slackbot")).toBeNull();
  });
});

describe("describeBoard", () => {
  it("counts from the arrays or from the projected counts", () => {
    expect(describeBoard({ nodes: [1, 2, 3], edges: [1] })).toBe("3 exhibits and 1 thread on an evidence board.");
    expect(describeBoard({ node_count: "1", edge_count: "0" })).toBe("1 exhibit and 0 threads on an evidence board.");
  });
  it("says something generic for an empty board", () => {
    expect(describeBoard({ nodes: [] })).toBe("An evidence board on Forensic.");
    expect(describeBoard(undefined)).toBe("An evidence board on Forensic.");
  });
});
