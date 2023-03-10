import { Box } from '@chakra-ui/react';
import styled from '@emotion/styled';
import type { Language } from 'prism-react-renderer';
import Highlight, { defaultProps } from 'prism-react-renderer';
import theme from 'prism-react-renderer/themes/vsDark';
import { FaCopy } from 'react-icons/fa';
import { CopyToClipboardButton } from '../CopyToClipboardButton';

const Pre = styled.pre`
  text-align: left;
  padding: 0.5em;
  overflow: scroll;
  font-size: 0.8rem;
`;

const Line = styled.div`
  display: table-row;
`;

const LineNo = styled.span`
  display: table-cell;
  text-align: right;
  padding-right: 1em;
  user-select: none;
  opacity: 0.5;
`;

const LineContent = styled.span`
  display: table-cell;
`;

const Container = styled.div`
  position: relative;
`;

const TopRightButton = styled(CopyToClipboardButton)`
  position: absolute;
  top: 8px;
  right: 8px;
`;

export const CodeSample = ({
  code,
  copyToClipboardButton,
  legend,
  language,
}: {
  code: string;
  copyToClipboardButton?: boolean;
  legend?: React.ReactNode;
  language: Language;
}) => {
  return (
    <Container>
      <Highlight
        {...defaultProps}
        theme={theme}
        code={code}
        language={language}
      >
        {({
          className,
          style,
          tokens,
          getLineProps,
          getTokenProps,
        }) => (
          <Pre className={className} style={style}>
            {tokens.map((line, i) => (
              <Line key={i} {...getLineProps({ line, key: i })}>
                <LineNo>{i + 1}</LineNo>
                <LineContent>
                  {line.map((token, key) => (
                    <span
                      key={key}
                      {...getTokenProps({ token, key })}
                    />
                  ))}
                </LineContent>
              </Line>
            ))}
          </Pre>
        )}
      </Highlight>
      {legend && (
        <Box bgColor={'yellow.600'}>
          <Box pl={1}>{legend}</Box>
        </Box>
      )}
      {copyToClipboardButton && (
        <TopRightButton
          variant={'solid'}
          textToPutInClipboard={code}
          rightIcon={<FaCopy />}
          size={'xs'}
        >
          COPY
        </TopRightButton>
      )}
    </Container>
  );
};
