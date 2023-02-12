import type { InputProps } from "@chakra-ui/react";

import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  useDisclosure,
  useMergeRefs,
} from "@chakra-ui/react";
import { forwardRef, useRef } from "react";
import type { FieldError } from "react-hook-form";
import { HiEye, HiEyeOff } from "react-icons/hi";

export const PasswordField = forwardRef<
  HTMLInputElement,
  InputProps & { error?: FieldError }
>((props, ref) => {
  const { isOpen, onToggle } = useDisclosure();
  const inputRef = useRef<HTMLInputElement>(null);

  const mergeRef = useMergeRefs(inputRef, ref);
  const onClickReveal = () => {
    onToggle();
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  };

  return (
    <FormControl isInvalid={!!props.error}>
      <FormLabel htmlFor="password">Password</FormLabel>
      <InputGroup>
        <InputRightElement>
          <IconButton
            variant="link"
            aria-label={isOpen ? "Mask password" : "Reveal password"}
            icon={isOpen ? <HiEyeOff /> : <HiEye />}
            onClick={onClickReveal}
          />
        </InputRightElement>
        <Input
          ref={mergeRef}
          type={isOpen ? "text" : "password"}
          required
          {...props}
        />
      </InputGroup>
    </FormControl>
  );
});

PasswordField.displayName = "PasswordField";
