import { getOneFromFirestore } from "@/firestore";
import { Project, ProjectId } from "@/project";
import { pipe } from "fp-ts/lib/function.js";

export const getProjectById = ({ projectId }: { projectId: ProjectId }) =>
  pipe(getOneFromFirestore(Project, `/projects/${projectId}`));
