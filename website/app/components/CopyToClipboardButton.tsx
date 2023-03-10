import type { ButtonProps } from '@chakra-ui/react';
import { Button } from '@chakra-ui/react';
import styled from '@emotion/styled';
import copy from 'copy-to-clipboard';
import { useState } from 'react';

export const CopyToClipboardButton = ({
  textToPutInClipboard,
  tempButtonText = 'COPIED',
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
      <SmallCaps>
        {tempDisplayed ? tempButtonText : children}
      </SmallCaps>
    </Button>
  );
};

const SmallCaps = styled.span`
  font-variant-caps: petite-caps;
`;
