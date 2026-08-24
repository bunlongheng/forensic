import handler from "../../lib/handlers/auth-logout.js";
import { withErrors } from "../../lib/wrap.js";

export default withErrors(handler);
