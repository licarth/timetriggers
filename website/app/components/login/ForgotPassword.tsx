import {
  Box,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  Icon,
} from "@chakra-ui/react";
import { Logo } from "../Logo";

import styled from "@emotion/styled";
import { FirebaseError } from "@firebase/app";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useFirebaseAuth } from "~/contexts/FirebaseAuthContext";
import { BsMailbox } from "react-icons/bs";

type Inputs = {
  email: string;
};

export const ForgotPassword = () => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Inputs>();

  const [isQueryingForm, setIsQueryingForm] = useState(true);

  const { sendPasswordResetEmail } = useFirebaseAuth();

  const onSubmit: SubmitHandler<Inputs> = async ({ email }) => {
    try {
      await sendPasswordResetEmail({ email });
      setIsQueryingForm(false);
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (
          error.code === "auth/wrong-password" ||
          error.code === "auth/user-not-found"
        ) {
          setError("root", {
            message: "Please check your email and password and try again.",
          });
        }
        console.log(error.code);
      } else {
        setError("root", { message: "Something went wrong!" });
      }
    }
  };

  return (
    <Container
      maxW="lg"
      py={{ base: "12", md: "24" }}
      px={{ base: "0", sm: "8" }}
    >
      {isQueryingForm ? (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing="8">
            <Stack spacing="6">
              <Logo />
              <Stack spacing={{ base: "2", md: "3" }} textAlign="center">
                <Heading size={{ base: "xl", md: "xxl" }}>
                  Forgot your password?
                </Heading>
                <Text>
                  Tell us your email address, we'll send you an email to reset
                  your password
                </Text>
              </Stack>
            </Stack>
            <Box
              py={{ base: "0", sm: "8" }}
              px={{ base: "4", sm: "10" }}
              bg={{ base: "transparent", sm: "bg-surface" }}
              boxShadow={{ base: "none", sm: "md" }}
              borderRadius={{ base: "none", sm: "xl" }}
            >
              <Stack spacing="6">
                <Stack spacing="5">
                  <RootErrorMessage>{errors.root?.message}</RootErrorMessage>
                  <FormControl isInvalid={!!errors.email}>
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && (
                      <FormErrorMessage>
                        {errors.email.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                </Stack>
                <Stack spacing="6">
                  <Button type="submit">Send Reset Password Email</Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </form>
      ) : (
        <Stack spacing="8">
          <Stack spacing="6">
            <Logo />
            <Stack spacing={{ base: "2", md: "3" }} textAlign="center">
              <Heading size={{ base: "xl", md: "xxl" }}>
                <Icon as={BsMailbox} />
                <Text>Check your email</Text>
              </Heading>
              <Text>We've sent you an email to reset your password</Text>
            </Stack>
          </Stack>
        </Stack>
      )}
    </Container>
  );
};

const RootErrorMessage = styled.span`
  color: red;
`;
