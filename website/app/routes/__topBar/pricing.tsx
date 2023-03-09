import type { GridItemProps } from '@chakra-ui/react';
import {
  Box,
  Button,
  Card,
  Center,
  Grid,
  GridItem,
  HStack,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import styled from '@emotion/styled';
import type { MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';
import React from 'react';
import { BsCheck2Circle } from 'react-icons/bs';
import { H1 } from '~/components';
import { Footer } from '~/components/footer/Footer';

export const meta: MetaFunction = () => {
  return {
    title: 'Pricing',
  };
};

function DesktopPricing() {
  const redColor = useColorModeValue('red.400', 'red.400');

  const GreenCheck = ({
    smallCol,
  }: {
    smallCol?: React.ReactNode;
  }) => {
    const greenColor = useColorModeValue('green.500', 'green.400');
    return (
      <HStack>
        <Box color={greenColor}>
          <BsCheck2Circle />
        </Box>
        <Box display={{ base: 'block', lg: 'none' }}>{smallCol}</Box>
      </HStack>
    );
  };
  return (
    <StyledContainer
      margin={'auto'}
      maxW="6xl"
      py={{ base: '4', md: '8' }}
      px={{ base: '4', sm: '8' }}
      display="flex"
      flexDir={'column'}
      justifyItems={'center'}
      w="100%"
    >
      <H1 centered>We have 2 plans, Free and Flex</H1>
      <Card
        p={{ base: 0, lg: 10 }}
        display="flex"
        justifyItems={'center'}
        w="100%"
      >
        <Grid
          templateColumns={{
            base: 'none',
            lg: '0.7fr repeat(2, 1fr)',
          }}
          gridAutoFlow={'column'}
          // center
          margin={'auto'}
          columnGap={3}
          p={{ base: 2, lg: 5 }}
        >
          <FirstColCell></FirstColCell>
          <FirstColCell>Base Price</FirstColCell>
          <FirstColCell>Included Triggers</FirstColCell>
          <FirstColCell>Extra Triggers</FirstColCell>
          <FirstColCell>Retry failed triggers</FirstColCell>
          <FirstColCell>Rate Limits</FirstColCell>
          <FirstColCell></FirstColCell>
          <FirstColCell></FirstColCell>
          <FreePlanGridItem>
            <H1>Free</H1>
            <i>No credit card required</i>
          </FreePlanGridItem>
          <FreePlanGridItem>
            <Fare>
              <FarePrice>0€</FarePrice>
              <FareMonth>/ month</FareMonth>
            </Fare>
          </FreePlanGridItem>
          <FreePlanGridItem>
            <Fare>
              <FarePrice>500</FarePrice>
              <FareMonth> triggers / month</FareMonth>
            </Fare>
          </FreePlanGridItem>
          <FreePlanGridItem>
            <Text color={redColor}>
              Scheduling is disabled beyond 500 triggers per month
            </Text>
          </FreePlanGridItem>
          <FreePlanGridItem>
            <GreenCheck smallCol={'Retry failed triggers'} />
          </FreePlanGridItem>
          <FreePlanGridItem color={redColor}>
            Triggers are sent at max 1 per second
          </FreePlanGridItem>
          <FreePlanGridItem>
            <Link to="/signup">
              <Button variant={'outline'} colorScheme="green">
                Start Now 🚀
              </Button>
            </Link>
          </FreePlanGridItem>
          <FreePlanGridItem></FreePlanGridItem>
          <BlazeGridItem first>
            <H1>Flex</H1>
            <Center>
              <i>Pay as you go</i>
            </Center>
          </BlazeGridItem>
          <BlazeGridItem>
            <Fare>
              <FarePrice>10€</FarePrice>
              <FareMonth>/ month</FareMonth>
            </Fare>
          </BlazeGridItem>
          <BlazeGridItem>
            <Fare>
              <FarePrice>10k</FarePrice>
              <FareMonth> triggers / month</FareMonth>
            </Fare>
          </BlazeGridItem>
          <BlazeGridItem>
            <Stack>
              <VolumePricingTable />
            </Stack>
          </BlazeGridItem>
          <BlazeGridItem>
            <GreenCheck smallCol={'Retry failed triggers'} />
          </BlazeGridItem>
          <BlazeGridItem>Custom rate limits</BlazeGridItem>
          <BlazeGridItem>
            <Link to="/signup">
              <Button variant={'solid'} colorScheme="green">
                Start Now 🚀
              </Button>
            </Link>
          </BlazeGridItem>
          <BlazeGridItem last></BlazeGridItem>
        </Grid>
      </Card>
      <Footer />
    </StyledContainer>
  );
}

const VolumePricingTable = () => (
  <Table variant={'unstyled'} size="sm">
    <Thead>
      <Tr>
        <Th>Volume</Th>
        <Th>unit price</Th>
      </Tr>
    </Thead>
    <Tbody>
      <Tr>
        <Td>{'< 1 million'}</Td>
        <Td>
          <Fare>
            <Text fontSize="1.6em">2€</Text>
            <Text fontSize="0.7em">/10k triggers</Text>
          </Fare>
        </Td>
      </Tr>
      <Tr>
        <Td>{'> 1 million'}</Td>
        <Td>
          <Fare>
            <Text fontSize="1.6em">1€</Text>
            <Text fontSize="0.7em">/10k triggers</Text>
          </Fare>
        </Td>
      </Tr>
    </Tbody>
  </Table>
);

const FirstColCell = (props: { children?: React.ReactNode }) => (
  <GridItem
    display={{ base: 'none', lg: 'flex' }}
    flexDir="row"
    justifyContent="right"
    alignItems="center"
    p={4}
    textAlign="right"
    {...props}
  >
    {props.children}
  </GridItem>
);

const Fare = styled.span`
  display: flex;
  align-items: baseline;
`;

const FarePrice = styled.span`
  font-size: 2em;
  font-weight: 300;
`;

const FareMonth = styled.span`
  font-size: 1em;
  font-weight: 300;
`;

const StyledContainer = styled(Grid)`
  font-family: Inter;
  font-weight: 500;
`;

const StyledGridItem = (
  props: {
    children?: React.ReactNode;
    first?: boolean;
    last?: boolean;
  } & GridItemProps,
) => (
  <GridItem
    display={'flex'}
    flexDir="column"
    justifyContent="center"
    alignItems="center"
    p={4}
    textAlign="center"
    {...props}
    maxW={310}
  >
    {props.children}
  </GridItem>
);

const BlazeGridItem = (
  props: {
    children?: React.ReactNode;
    first?: boolean;
    last?: boolean;
  } & GridItemProps,
) => {
  const backgroundColor = useColorModeValue('cyan.200', 'cyan.800');
  return (
    <StyledGridItem
      bg={backgroundColor}
      borderTopRadius={props.first ? 10 : 0}
      borderBottomRadius={props.last ? 10 : 0}
      gridColumn={{ base: '1 / 1', sm: '2 / 2', lg: '3 / 3' }}
    >
      {props.children}
    </StyledGridItem>
  );
};

const FreePlanGridItem = (
  props: {
    children?: React.ReactNode;
    first?: boolean;
    last?: boolean;
  } & GridItemProps,
) => {
  return (
    <StyledGridItem
      borderTopRadius={props.first ? 10 : 0}
      borderBottomRadius={props.last ? 10 : 0}
      gridColumn={{ base: '1 / 1', sm: '1 / 2', lg: '2 / 3' }}
    >
      {props.children}
    </StyledGridItem>
  );
};

export default function () {
  return <DesktopPricing />;
}
