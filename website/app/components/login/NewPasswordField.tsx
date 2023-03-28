import { HStack, InputProps } from '@chakra-ui/react';

import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  Stack,
  useMergeRefs,
} from '@chakra-ui/react';
import { forwardRef, useRef } from 'react';
import type { FieldError } from 'react-hook-form';

export const NewPasswordField = forwardRef<
  HTMLInputElement,
  InputProps & { error?: FieldError; label?: string }
>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mergeRef = useMergeRefs(inputRef, ref);

  return (
    <FormControl isInvalid={!!props.error}>
      {props.label && (
        <FormLabel htmlFor="password">{props.label}</FormLabel>
      )}
      <InputGroup>
        <Stack w="100%">
          <Input
            ref={mergeRef}
            type={'password'}
            required
            {...props}
          />
          {props.error && (
            <FormErrorMessage>{props.error.message}</FormErrorMessage>
          )}
        </Stack>
      </InputGroup>
    </FormControl>
  );
});

NewPasswordField.displayName = 'PasswordField';
