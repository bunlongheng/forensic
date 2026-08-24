import handler from "../../lib/handlers/auth-callback.js";
import { withErrors } from "../../lib/wrap.js";

export default withErrors(handler);
