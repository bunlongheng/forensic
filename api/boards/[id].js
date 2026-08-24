import boardById from "../../lib/handlers/board-by-id.js";
import { withErrors } from "../../lib/wrap.js";

export default withErrors(boardById);
