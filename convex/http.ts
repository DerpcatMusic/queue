import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { registerDiditRoutes } from "./httpDidit";
import { registerStripeRoutes } from "./httpStripe";

const http = httpRouter();

auth.addHttpRoutes(http);
registerDiditRoutes(http);
registerStripeRoutes(http);

export default http;
