import { redirectDocument } from "react-router";
import { API_BASE_URL } from "@plane/constants";
import { mcpAuthorizationResumeUrl } from "@/helpers/mcp-connect";

export function clientLoader({ request }: { request: Request }) {
  const target = mcpAuthorizationResumeUrl(new URL(request.url).searchParams.get("flow"), API_BASE_URL);
  return redirectDocument(target ?? "/");
}

export default function McpConnectPage() {
  return <output>正在返回 Plane 授权页面…</output>;
}
