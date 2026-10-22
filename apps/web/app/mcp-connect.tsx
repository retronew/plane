import { redirectDocument, useSearchParams } from "react-router";
import { API_BASE_URL } from "@plane/constants";
import { mcpAuthorizationResumeUrl } from "@/helpers/mcp-connect";
import { OAuthConsent } from "@/components/oauth/consent";

export function clientLoader({ request }: { request: Request }) {
  const params = new URL(request.url).searchParams;
  if (params.has("flow")) {
    const target = mcpAuthorizationResumeUrl(params.get("flow"), API_BASE_URL);
    if (target) return redirectDocument(target);
  }
  return null;
}
export const meta = () => [{ name: "referrer", content: "no-referrer" }];
export default function McpConnectPage() {
  const [params] = useSearchParams();
  return <OAuthConsent key={params.get("consent")} flow={params.get("consent")} />;
}
