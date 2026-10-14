import boardById from "../../lib/handlers/board-by-id.js";
import unlock from "../../lib/handlers/unlock.js";
import { withErrors } from "../../lib/wrap.js";

// /api/boards/:id/unlock is rewritten here (vercel.json) with ?unlock=1 so the
// lock screen does not cost a 13th function: the Hobby plan stops at 12.
export default withErrors((req, res) => (req.query?.unlock === "1" ? unlock(req, res) : boardById(req, res)));
