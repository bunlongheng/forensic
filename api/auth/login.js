import handler from "../../lib/handlers/auth-login.js";
import { withErrors } from "../../lib/wrap.js";

export default withErrors(handler);
