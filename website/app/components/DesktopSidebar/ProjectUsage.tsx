import { Card, Heading, Progress, Skeleton, Text } from "@chakra-ui/react";
import { useRevalidator } from "@remix-run/react";
import type { MonthlyUsage, Project } from "@timetriggers/domain";
import { useEffect } from "react";
import { useFirstRender } from "./useFirstRender";

type ProjectUsageArgs = {
  usage: MonthlyUsage;
  selectedProjectSlug: string;
  hidden: boolean;
  project: Project;
};

export const ProjectUsage = ({
  usage,
  selectedProjectSlug,
  hidden,
  project,
}: ProjectUsageArgs) => {
  const now = new Date();
  const requestsDone = usage.getScheduleUsageForDate(now);
  const requestMonthlyQuota = project.overrideQuotaLimit || 500;
  let revalidator = useRevalidator();
  const firstRender = useFirstRender();

  // Force re-render on selectedProjectSlug change
  useEffect(() => {
    firstRender || revalidator.revalidate();
  }, [selectedProjectSlug]);

  return (
    <Card p={2} variant="outline" hidden={hidden}>
      <Heading mb={2} size={"xs"}>
        Api Quota Usage ({now.toLocaleString("default", { month: "short" })})
      </Heading>
      <Skeleton height="20px" hidden={revalidator.state === "idle"} />
      {revalidator.state === "idle" &&
        (project.getPricingPlan() === "free" ? (
          <>
            <Progress
              colorScheme="green"
              value={(requestsDone / requestMonthlyQuota) * 100}
              borderRadius={3}
              mb={1}
            />
            <Text fontSize="0.8em">
              {requestsDone} / {requestMonthlyQuota} triggers
            </Text>
          </>
        ) : (
          <Text>{requestsDone} / Unlimited</Text>
        ))}
    </Card>
  );
};
