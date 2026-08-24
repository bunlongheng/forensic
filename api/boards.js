import listBoards from "../lib/handlers/list-boards.js";
import createBoard from "../lib/handlers/create-board.js";
import { withErrors } from "../lib/wrap.js";

const handler = (req, res) => (req.method === "POST" ? createBoard(req, res) : listBoards(req, res));

export default withErrors(handler);
