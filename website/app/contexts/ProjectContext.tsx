import type { Project } from '@timetriggers/domain';
import * as React from 'react';

type ContextState = { project: Project };

const ProjectJobsContext = React.createContext<
  ContextState | undefined
>(undefined);

const ProjectProvider = ({
  children,
  project,
}: React.PropsWithChildren & { project: Project }) => {
  return (
    <ProjectJobsContext.Provider value={{ project }}>
      {children}
    </ProjectJobsContext.Provider>
  );
};

function useProject() {
  const context = React.useContext(ProjectJobsContext);
  if (context === undefined) {
    throw new Error(
      'useProject must be used within a ProjectProvider',
    );
  }
  return context;
}

export { ProjectProvider, useProject };
