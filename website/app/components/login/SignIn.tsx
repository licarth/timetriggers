import {
  Box,
  Button,
  Center,
  Checkbox,
  Container,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Logo } from '../Logo';
import { OAuthButtonGroup } from './OAuthButtonGroup';
import { PasswordField } from './PasswordField';

import styled from '@emotion/styled';
import { FirebaseError } from '@firebase/app';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useFirebaseAuth } from '~/contexts/FirebaseAuthContext';
import { useState } from 'react';

type Inputs = {
  email: string;
  password: string;
};

export const SignIn = () => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Inputs>();

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { emailPasswordSignIn } = useFirebaseAuth();

  const onSubmit: SubmitHandler<Inputs> = async ({
    email,
    password,
  }) => {
    try {
      await emailPasswordSignIn({ email, password });
      navigate('/projects');
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (
          error.code === 'auth/wrong-password' ||
          error.code === 'auth/user-not-found'
        ) {
          setError('root', {
            message:
              'Please check your email and password and try again.',
          });
        }
        console.log(error.code);
      } else {
        setError('root', { message: 'Something went wrong!' });
      }
    }
  };

  return (
    <Container
      maxW="lg"
      py={{ base: '12', md: '24' }}
      px={{ base: '0', sm: '8' }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing="8">
          <Stack spacing="6">
            <Logo />
            <Stack
              spacing={{ base: '2', md: '3' }}
              textAlign="center"
            >
              <Heading size={{ base: 'xs', md: 'sm' }}>
                Sign In with your existing account
              </Heading>
              <HStack spacing="1" justify="center">
                <Text color="muted">No account yet?</Text>
                <Button
                  variant={'link'}
                  onClick={() => navigate('/signup')}
                >
                  Sign Up
                </Button>
              </HStack>
            </Stack>
          </Stack>
          <Box
            py={{ base: '0', sm: '8' }}
            px={{ base: '4', sm: '10' }}
            bg={{ base: 'transparent', sm: 'chakra-body-bg' }}
            boxShadow={{ base: 'none', sm: 'md' }}
            borderRadius={{ base: 'none', sm: 'xl' }}
            minH={{ base: 'sm' }}
          >
            {loading ? (
              <Center>
                <Spinner />
              </Center>
            ) : (
              <Stack spacing="6">
                <Stack spacing="5">
                  <RootErrorMessage>
                    {errors.root?.message}
                  </RootErrorMessage>
                  <FormControl isInvalid={!!errors.email}>
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                    />
                    {errors.email && (
                      <FormErrorMessage>
                        {errors.email.message}
                      </FormErrorMessage>
                    )}
                  </FormControl>
                  <PasswordField
                    {...register('password')}
                    error={errors.password}
                  />
                </Stack>
                <HStack justify="space-between">
                  <Checkbox defaultChecked>Remember me</Checkbox>
                  <Button
                    variant="link"
                    colorScheme="blue"
                    size="sm"
                    onClick={() =>
                      navigate('/account/forgot-password')
                    }
                  >
                    Forgot password?
                  </Button>
                </HStack>
                <Stack spacing="6">
                  <Button type="submit">Sign In</Button>
                  <HStack>
                    <Divider />
                    <Text
                      fontSize="sm"
                      whiteSpace="nowrap"
                      color="muted"
                    >
                      or continue with
                    </Text>
                    <Divider />
                  </HStack>
                  <OAuthButtonGroup setLoading={setLoading} />
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </form>
    </Container>
  );
};

const RootErrorMessage = styled.span`
  color: red;
`;
