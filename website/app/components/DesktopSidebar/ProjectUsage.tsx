import { Card, Heading, Progress, Skeleton, Text } from "@chakra-ui/react";
import { useRevalidator } from "@remix-run/react";
import type { MonthlyUsage } from "@timetriggers/domain";
import { useEffect } from "react";
import { useFirstRender } from "./useFirstRender";

type ProjectUsageArgs = {
  usage: MonthlyUsage;
  selectedProjectSlug: string;
};

export const ProjectUsage = ({
  usage,
  selectedProjectSlug,
}: ProjectUsageArgs) => {
  const u = usage?.getScheduleUsageForYearMonth(2023, 2) || 0;
  const requestMonthlyQuota = 500;
  let revalidator = useRevalidator();
  const firstRender = useFirstRender();

  // Force re-render on selectedProjectSlug change
  useEffect(() => {
    firstRender || revalidator.revalidate();
  }, [selectedProjectSlug]);
  return (
    <Card p={2} variant="outline">
      <Heading mb={2} size={"xs"}>
        Api Quota Usage
      </Heading>
      <Skeleton height="20px" hidden={revalidator.state === "idle"} />
      {revalidator.state === "idle" && (
        <>
          <Progress
            colorScheme="green"
            value={(u / requestMonthlyQuota) * 100}
            borderRadius={3}
            mb={1}
          />
          <Text fontSize="0.8em">
            {u} / {requestMonthlyQuota} requests
          </Text>
        </>
      )}
    </Card>
  );
};
