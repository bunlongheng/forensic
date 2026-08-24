import health from "../lib/handlers/health.js";
import { withErrors } from "../lib/wrap.js";

export default withErrors(health);
