import { Card, HStack, Input, Stack, Text } from '@chakra-ui/react';
import type { Clock } from '@timetriggers/domain';
import {
  evaluateDateFunctionsString,
  SystemClock,
} from '@timetriggers/domain';
import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import { useEffect, useState } from 'react';
import { BsClock } from 'react-icons/bs';
import { HttpHeader } from '../HttpHeader';
import { humanReadibleDurationFromNow } from '../humanReadibleDurationFromNow';

const clock: Clock = new SystemClock();

export const DateFunctionsCalculator = () => {
  const initialValue = 'now | add 1d';
  const [ttrScheduledAt, setTtrScheduledAt] = useState<string>();

  useEffect(() => {
    setTtrScheduledAt(initialValue);
  }, []);

  return (
    <Stack>
      <HStack>
        <HttpHeader>ttr-scheduled-at</HttpHeader>
        <Input
          htmlSize={50}
          width="auto"
          size={'sm'}
          defaultValue={initialValue}
          onChange={(e) => setTtrScheduledAt(e.target.value)}
        />
      </HStack>
      <Card p={3}>
        <HStack>
          <BsClock />
          {ttrScheduledAt && (
            <>
              {pipe(
                ev(ttrScheduledAt, clock),
                E.foldW(
                  (e) => (
                    <Text
                      bg={'red.500'}
                    >{`Error: ${e.message}`}</Text>
                  ),
                  (date) => (
                    <Stack>
                      <Text>{date.toString()}</Text>
                      <Text>
                        Relative to now:{' '}
                        {humanReadibleDurationFromNow(date)}
                      </Text>
                    </Stack>
                  ),
                ),
              )}
            </>
          )}
        </HStack>
      </Card>
    </Stack>
  );
};

const ev = (ttrScheduledAt: string, clock: Clock) =>
  pipe(
    E.tryCatch(
      () =>
        evaluateDateFunctionsString(ttrScheduledAt)({
          clock,
        }),
      E.toError,
    ),
  );
