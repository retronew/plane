import { Outlet } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectsListMobileHeader } from "@/components/projects/mobile-header";
import { ProjectsBaseHeader } from "@/components/project/header";

/** App chrome shared by the project list and the archived-projects routes. */
export function ProjectsLayoutShell() {
  return (
    <>
      <AppHeader header={<ProjectsBaseHeader />} mobileHeader={<ProjectsListMobileHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
