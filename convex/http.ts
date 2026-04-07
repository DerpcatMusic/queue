import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { airwallexWebhook } from "./webhooksAirwallex";
import { diditWebhook } from "./webhooksDidit";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/webhooks/didit",
  method: "POST",
  handler: diditWebhook,
});
http.route({
  path: "/webhooks/airwallex",
  method: "POST",
  handler: airwallexWebhook,
});

export default http;
