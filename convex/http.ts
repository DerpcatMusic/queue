import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { rapydBeneficiaryReturnBridge, rapydCheckoutReturnBridge } from "./rapydReturnBridge";
import { diditWebhook, rapydWebhook } from "./webhooks";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/webhooks/rapyd",
  method: "POST",
  handler: rapydWebhook,
});
http.route({
  path: "/webhooks/didit",
  method: "POST",
  handler: diditWebhook,
});
http.route({
  path: "/rapyd/beneficiary-return-bridge",
  method: "GET",
  handler: rapydBeneficiaryReturnBridge,
});
http.route({
  path: "/rapyd/checkout-return-bridge",
  method: "GET",
  handler: rapydCheckoutReturnBridge,
});

export default http;
