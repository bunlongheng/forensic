import og from "../lib/handlers/og.js";
import linkTitle from "../lib/handlers/link-title.js";
import { withErrors } from "../lib/wrap.js";

// /api/link-title is rewritten here (vercel.json) with ?linktitle=1 so it does
// not cost a 13th function: the Hobby plan stops at 12.
export default withErrors((req, res) => (req.query?.linktitle === "1" ? linkTitle(req, res) : og(req, res)));
