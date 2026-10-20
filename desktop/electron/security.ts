export const CHANNEL = "gmt:read";
export function validateOperation(
  args: unknown[],
): "status" | "health" | "attribution" {
  if (
    args.length !== 1 ||
    (args[0] !== "status" && args[0] !== "health" && args[0] !== "attribution")
  )
    throw Error("Operation not permitted");
  return args[0];
}
export function assertSender(
  event: { sender: unknown; senderFrame: unknown },
  contents: { mainFrame: unknown },
  expectedURL: string,
  actualURL: string,
) {
  if (
    event.sender !== contents ||
    event.senderFrame !== contents.mainFrame ||
    actualURL !== expectedURL
  )
    throw Error("Untrusted renderer");
}
export const packagedCSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'; frame-ancestors 'none'";
