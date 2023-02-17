import { useLocation, useNavigate } from "@remix-run/react";

export const useProjectNavigation = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const navigateToProject = (slug: string) => {
    const currentProjectPath = pathname.split("/").slice(3).join("/");
    navigate(`/projects/${slug}/${currentProjectPath}`);
  };

  return { navigateToProject };
};
