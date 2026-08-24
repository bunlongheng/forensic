import handler from "../../lib/handlers/auth-me.js";
import { withErrors } from "../../lib/wrap.js";

export default withErrors(handler);
