import { Button } from "@chakra-ui/button";

import { useOptionalUser } from "~/utils";

export default function Index() {
  const user = useOptionalUser();
  return <Button colorScheme="blue">Button</Button>;
}
