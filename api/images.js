import { createImage } from "../lib/handlers/images.js";
import { withErrors } from "../lib/wrap.js";

export default withErrors(createImage);
