import type { ButtonProps } from "@chakra-ui/react";
import { Button } from "@chakra-ui/react";
import copy from "copy-to-clipboard";
import { useState } from "react";

export const CopyToClipboardButton = ({
  textToPutInClipboard,
  tempButtonText = "Copied",
  children,
  ...props
}: {
  textToPutInClipboard: string;
  tempButtonText?: string;
} & ButtonProps) => {
  const [tempDisplayed, setTempDisplayed] = useState(false);
  return (
    <Button
      {...props}
      onClick={() => {
        copy(textToPutInClipboard) && setTempDisplayed(true);
        setTimeout(() => {
          setTempDisplayed(false);
        }, 1000);
      }}
    >
      {tempDisplayed ? tempButtonText : children}
    </Button>
  );
};
