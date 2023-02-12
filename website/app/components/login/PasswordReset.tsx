import {
  Box,
  Button,
  Checkbox,
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
import { PasswordField } from "./PasswordField";

import styled from "@emotion/styled";
import { FirebaseError } from "@firebase/app";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { useFirebaseAuth } from "~/contexts/FirebaseAuthContext";
import { NewPasswordField } from "./NewPasswordField";
import { initializeFirebaseWeb } from "~/initializeFirebaseWeb";
import { confirmPasswordReset } from "firebase/auth";
import { useSearchParams } from "@remix-run/react";

type Inputs = {
  password: string;
  passwordConfirmation: string;
};

export const PasswordReset = () => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    watch,
  } = useForm<Inputs>();

  const navigate = useNavigate();
  const { auth } = initializeFirebaseWeb();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  if (!oobCode) {
    return <div>Invalid link</div>;
  }

  const onSubmit: SubmitHandler<Inputs> = async ({ password }) => {
    try {
      await confirmPasswordReset(auth, oobCode, password);
      navigate("/login");
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === "auth/weak-password") {
          setError("root", {
            message: "New password is too weak",
          });
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
              <Heading size={{ base: "xl", md: "xxl" }}>
                Enter a new password
              </Heading>
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
                <Button type="submit">Send Reset Password Email</Button>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </form>
    </Container>
  );
};

const RootErrorMessage = styled.span`
  color: red;
`;
