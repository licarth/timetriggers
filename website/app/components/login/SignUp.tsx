import {
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Logo } from "../Logo";
import { OAuthButtonGroup } from "./OAuthButtonGroup";

import { FirebaseError } from "@firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { initializeFirebaseWeb } from "~/initializeFirebaseWeb";
import { NewPasswordField } from "./NewPasswordField";

type Inputs = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

export const SignUp = () => {
  const auth = getAuth(initializeFirebaseWeb().app);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Inputs>();

  const navigate = useNavigate();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    try {
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      navigate("/projects");
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === "auth/email-already-in-use") {
          setError("email", {
            message: "That email address is already in use!",
          });
        } else if (error.code === "auth/invalid-email") {
          setError("email", { message: "That email address is invalid!" });
        } else if (error.code === "auth/weak-password") {
          setError("password", { message: "That password is too weak!" });
        }
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing="8">
          <Stack spacing="6">
            <Logo />
            <Stack spacing={{ base: "2", md: "3" }} textAlign="center">
              <Heading size={{ base: "xs", md: "sm" }}>
                Create an account
              </Heading>
              <HStack spacing="1" justify="center">
                <Text color="muted">Already have an account?</Text>
                <Button variant={"link"} onClick={() => navigate("/login")}>
                  Log In
                </Button>
              </HStack>
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
                <FormControl isInvalid={!!errors.email}>
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && (
                    <FormErrorMessage>{errors.email.message}</FormErrorMessage>
                  )}
                </FormControl>
                <NewPasswordField
                  {...register("password")}
                  error={errors.password}
                  label="Password"
                />
                <NewPasswordField
                  {...register("passwordConfirmation", {
                    validate: (val: string) => {
                      if (watch("password") != val) {
                        return "Your passwords do no match";
                      }
                    },
                  })}
                  error={errors.passwordConfirmation}
                  label="Confirm Password"
                />
              </Stack>
              <Stack spacing="6">
                <Button type="submit">Create Account</Button>
                <HStack>
                  <Divider />
                  <Text fontSize="sm" whiteSpace="nowrap" color="muted">
                    or continue with
                  </Text>
                  <Divider />
                </HStack>
                <OAuthButtonGroup />
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </form>
    </Container>
  );
};
