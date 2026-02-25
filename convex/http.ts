import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { rapydWebhook } from "./webhooks";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/webhooks/rapyd",
  method: "POST",
  handler: rapydWebhook,
});

export default http;
