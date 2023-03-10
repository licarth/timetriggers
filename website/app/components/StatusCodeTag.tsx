import { Tag, Text, Tooltip } from '@chakra-ui/react';
import { colorByStatusCode } from './colorByStatusCode';
import { httpCodeExplanation } from './httpCodeExplanation';

export const StatusCodeTag = ({
  code,
}: {
  code: number | string;
}) => (
  <Tag size={'sm'} colorScheme={colorByStatusCode(Number(code))}>
    <Tooltip label={<Text>{httpCodeExplanation(Number(code))}</Text>}>
      <Text>{code}</Text>
    </Tooltip>
  </Tag>
);
