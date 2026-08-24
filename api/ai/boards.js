import createBoard from "../../lib/handlers/create-board.js";
import { withErrors } from "../../lib/wrap.js";

export default withErrors(createBoard);
