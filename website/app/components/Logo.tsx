import styled from "@emotion/styled";

export const Logo = ({ fontSize }: { fontSize?: string }) => (
  <LogoFont $fontSize={fontSize || "2rem"}>timetriggers.io</LogoFont>
);

export const LogoFont = styled.span<{ $fontSize: string }>`
  text-align: center;
  font-family: Inter;
  font-style: normal;
  font-weight: 200;
  font-size: ${(props) => props.$fontSize};
`;
