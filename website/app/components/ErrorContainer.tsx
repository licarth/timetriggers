import { Container } from '@chakra-ui/react';
import { Heading } from './Headings';

export const ErrorContainer = ({ error }: { error: string }) => {
  return (
    <Container m="auto">
      <Heading>Oops, something went wrong</Heading>
      <p>{error}</p>
    </Container>
  );
};
