import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const query = vi.fn();
vi.mock("../../lib/db.js", () => ({ default: { query: (...a) => query(...a) } }));

const { isBot, clientIp, readVisit, alertHtml, lookupIp, notifyShareView } = await import("../../lib/share-alert.js");

const BOARD = { id: "00000000-0000-0000-0000-000000000001", title: "Case 42" };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const GEO = { hostname: "c-73-159-109-147.hsd1.ma.comcast.net", city: "Springfield", region: "Massachusetts", country: "US", loc: "42.1015,-72.5898", org: "AS7922 Comcast", postal: "01103", timezone: "America/New_York" };

function req(headers = {}, remoteAddress = "203.0.113.7") {
  return { method: "GET", headers, socket: { remoteAddress } };
}

// A fetch stub that answers ipinfo with GEO and everything else with `rest`.
function stubFetch(rest = { ok: true, json: async () => ({}) }) {
  const fetch = vi.fn(async (url) => (String(url).startsWith("https://ipinfo.io/") ? { ok: true, json: async () => GEO } : rest));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

// 2 db calls per alert before delivery: the INSERT (returning id) and the COUNT.
function dbOk(n = 3) {
  query.mockResolvedValueOnce({ rows: [{ id: "log-1" }] }).mockResolvedValueOnce({ rows: [{ n }] }).mockResolvedValue({ rows: [] });
}

describe("share-alert", () => {
  const ENV = ["RESEND_API_KEY", "OWNER_EMAIL", "STICKIES_API_KEY", "SHARE_ALERT_FROM", "IPINFO_TOKEN"];
  const orig = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  beforeEach(() => {
    query.mockReset();
    for (const k of ENV) delete process.env[k];
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const k of ENV) {
      if (orig[k] === undefined) delete process.env[k];
      else process.env[k] = orig[k];
    }
  });

  describe("isBot", () => {
    it("skips link-preview crawlers and headless browsers", () => {
      for (const ua of ["Slackbot-LinkExpanding 1.0", "facebookexternalhit/1.1", "Twitterbot/1.0", "WhatsApp/2.23", "TelegramBot", "Discordbot/2.0", "LinkedInBot/1.0", "Applebot/0.1", "HeadlessChrome/120", "Mozilla/5.0 (compatible; Googlebot/2.1)", "iMessage link preview"]) {
        expect(isBot(ua), ua).toBe(true);
      }
    });
    it("keeps real browsers and an empty user agent", () => {
      expect(isBot(IPHONE)).toBe(false);
      expect(isBot("")).toBe(false);
      expect(isBot(null)).toBe(false);
    });
  });

  describe("clientIp", () => {
    it("prefers x-vercel-forwarded-for, then x-forwarded-for, then x-real-ip, then the socket", () => {
      expect(clientIp(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3" }))).toBe("1.1.1.1");
      expect(clientIp(req({ "x-forwarded-for": "2.2.2.2, 10.0.0.1", "x-real-ip": "3.3.3.3" }))).toBe("2.2.2.2");
      expect(clientIp(req({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
      expect(clientIp(req({}, "::ffff:9.9.9.9"))).toBe("9.9.9.9");
      expect(clientIp({ headers: {} })).toBe("unknown");
    });
  });

  describe("readVisit", () => {
    it("reads the Vercel geo headers and defaults kind to view", () => {
      const v = readVisit(req({ "x-forwarded-for": "73.159.109.147", "x-vercel-ip-city": "Spring%20Field", "x-vercel-ip-country": "US", "user-agent": IPHONE, referer: "https://t.co/x" }), BOARD);
      expect(v).toMatchObject({ boardId: BOARD.id, title: "Case 42", kind: "view", ip: "73.159.109.147", city: "Spring Field", country: "US", userAgent: IPHONE, referer: "https://t.co/x" });
      expect(v.at).toBeInstanceOf(Date);
    });
    it("falls back to Untitled Board and nulls", () => {
      const v = readVisit(req({}), { id: BOARD.id, title: "" }, "unlock");
      expect(v).toMatchObject({ title: "Untitled Board", kind: "unlock", city: null, country: null, userAgent: null, referer: null });
    });
  });

  describe("alertHtml", () => {
    it("carries the view number, the geo table, the map, and escapes values", () => {
      const v = { ...readVisit(req({ "x-forwarded-for": "73.159.109.147", "user-agent": "<ua>" }), { ...BOARD, title: 'A "quoted" <title>' }), geo: GEO };
      const html = alertHtml(v, 7);
      expect(html).toContain("This is view <b>7</b> of this board.");
      expect(html).toContain('<img src="https://forensic-bheng.vercel.app/icon-96.png" alt="Forensic"');
      expect(html).toContain("opened the shared link");
      expect(html).toContain("https://static-maps.yandex.ru/1.x/?lang=en_US&ll=-72.5898,42.1015&z=9&size=600,300&l=map&pt=-72.5898,42.1015,pm2rdm");
      expect(html).toContain("Springfield");
      expect(html).toContain("Massachusetts");
      expect(html).toContain("https://ipinfo.io/73.159.109.147");
      expect(html).toContain(`<a href="https://forensic-bheng.vercel.app/?id=${BOARD.id}"`);
      expect(html).toContain("A &quot;quoted&quot; &lt;title&gt;");
      expect(html).toContain("&lt;ua&gt;");
      expect(html).not.toContain("<ua>");
      expect(html).not.toContain("—");
    });
    it("says unknown without geo, has no map, and reads unlock for a passcode", () => {
      const html = alertHtml({ ...readVisit(req({}), BOARD, "unlock"), geo: null }, 1);
      expect(html).toContain("entered the passcode");
      expect(html).toContain("passcode unlock");
      expect(html).toContain("unknown");
      expect(html).not.toContain("static-maps.yandex.ru");
    });
  });

  describe("lookupIp", () => {
    it("skips private, loopback and unknown addresses without a request", async () => {
      const fetch = stubFetch();
      for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.9", "172.16.0.1", "::1", "unknown", ""]) expect(await lookupIp(ip)).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
    it("keeps the ipinfo fields and appends the token when set", async () => {
      process.env.IPINFO_TOKEN = "tok";
      const fetch = stubFetch();
      expect(await lookupIp("73.159.109.147")).toEqual(GEO);
      expect(fetch.mock.calls[0][0]).toBe("https://ipinfo.io/73.159.109.147/json?token=tok");
    });
    it("is null on a non-2xx or a thrown fetch", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
      expect(await lookupIp("8.8.8.8")).toBeNull();
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
      expect(await lookupIp("8.8.8.8")).toBeNull();
    });
  });

  describe("notifyShareView", () => {
    const visit = () => readVisit(req({ "x-forwarded-for": "73.159.109.147", "user-agent": IPHONE }), BOARD);

    it("logs the view, emails once through Resend with the right to and subject, and marks the row emailed", async () => {
      process.env.RESEND_API_KEY = "re_test";
      process.env.OWNER_EMAIL = "owner@example.com";
      dbOk(3);
      const fetch = stubFetch({ ok: true });
      await notifyShareView(visit());
      expect(query.mock.calls[0][0]).toMatch(/INSERT INTO share_view_log/);
      expect(query.mock.calls[0][1]).toEqual([BOARD.id, "Case 42", "view", "73.159.109.147", null, null, IPHONE, null]);
      const resend = fetch.mock.calls.filter(([u]) => u === "https://api.resend.com/emails");
      expect(resend).toHaveLength(1);
      expect(resend[0][1].headers.Authorization).toBe("Bearer re_test");
      const body = JSON.parse(resend[0][1].body);
      expect(body).toMatchObject({ from: "Forensic <onboarding@resend.dev>", to: ["owner@example.com"], subject: "Opened: Case 42 - 73.159.109.147" });
      expect(body.html).toContain("view <b>3</b>");
      expect(body.html).toContain("Springfield");
      expect(query.mock.calls[2]).toEqual([expect.stringMatching(/SET emailed = true WHERE id = \$1/), ["log-1"]]);
    });

    it("delivers to both channels when both keys are set", async () => {
      process.env.RESEND_API_KEY = "re_test";
      process.env.OWNER_EMAIL = "owner@example.com";
      process.env.STICKIES_API_KEY = "sk_test";
      dbOk(2);
      const fetch = stubFetch({ ok: true });
      await notifyShareView(visit());
      expect(fetch.mock.calls.filter(([u]) => u === "https://api.resend.com/emails")).toHaveLength(1);
      expect(fetch.mock.calls.filter(([u]) => u === "http://localhost:4444/api/stickies/ext")).toHaveLength(1);
      expect(query.mock.calls.some(([q]) => /SET emailed = true/.test(q))).toBe(true);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("posts a Stickies note when no email key is set, with the Opened prefix never stacked", async () => {
      process.env.STICKIES_API_KEY = "sk_test";
      dbOk(1);
      const fetch = stubFetch({ ok: true });
      await notifyShareView({ ...visit(), title: "Opened: Opened: Case 42" });
      const note = fetch.mock.calls.filter(([u]) => u === "http://localhost:4444/api/stickies/ext");
      expect(note).toHaveLength(1);
      expect(note[0][1].headers.Authorization).toBe("Bearer sk_test");
      const body = JSON.parse(note[0][1].body);
      expect(body).toMatchObject({ type: "html", title: "Opened: Case 42", folder: "Alerts", icon: "__hero:EyeIcon" });
      expect(body.content).toContain("view <b>1</b>");
      expect(fetch.mock.calls.some(([u]) => u === "https://api.resend.com/emails")).toBe(false);
      expect(query.mock.calls.some(([q]) => /SET emailed/.test(q))).toBe(false);
    });

    it("warns instead of posting when neither delivery key is set", async () => {
      dbOk(1);
      const fetch = stubFetch();
      await notifyShareView(visit());
      expect(fetch.mock.calls.every(([u]) => String(u).startsWith("https://ipinfo.io/"))).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/nobody alerted/));
    });

    it("still posts the note when Resend answers with an error", async () => {
      process.env.RESEND_API_KEY = "re_test";
      process.env.OWNER_EMAIL = "owner@example.com";
      process.env.STICKIES_API_KEY = "sk_test";
      dbOk(2);
      const fetch = stubFetch({ ok: false, status: 500, text: async () => '{"message":"boom"}' });
      await notifyShareView(visit());
      expect(fetch.mock.calls.some(([u]) => u === "http://localhost:4444/api/stickies/ext")).toBe(true);
      expect(console.error).toHaveBeenCalledWith("[share-alert] resend", 500, '{"message":"boom"}');
      expect(console.error).toHaveBeenCalledWith("[share-alert] failed:", "stickies 500");
    });

    it("never throws when the database is down", async () => {
      query.mockRejectedValue(new Error("ECONNREFUSED"));
      const fetch = stubFetch();
      await expect(notifyShareView(visit())).resolves.toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith("[share-alert] failed:", "ECONNREFUSED");
    });
  });
});
