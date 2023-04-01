import {
  Flex,
  Icon,
  Link as ChakraLink,
  Menu,
  MenuButton,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link as RemixLink } from '@remix-run/react';
import { FiExternalLink } from 'react-icons/fi';
import type { NavItemProps } from './NavItemProps';

export const NavItem = ({
  navSize,
  icon,
  title,
  active,
  disabled,
  comingSoon,
  href,
  externalLink,
}: NavItemProps) => {
  const activeColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const disabledColor = useColorModeValue('gray.300', 'gray.600');

  return (
    <Flex
      mt={15}
      flexDir="column"
      w={'100%'}
      alignItems={navSize === 'small' ? 'center' : 'flex-start'}
    >
      <Menu placement="right">
        <ChakraLink
          relative="path"
          as={RemixLink}
          to={href || '#'}
          padding={3}
          borderRadius={8}
          bgColor={active ? activeColor : 'none'}
          color={disabled ? disabledColor : textColor}
          w={navSize === 'large' ? '100%' : 'auto'}
        >
          <Tooltip label="Coming Soon !" hidden={!comingSoon}>
            <MenuButton w={'100%'} disabled={disabled}>
              <Flex>
                <Icon as={icon} alignSelf="center" />
                <Text
                  ml={5}
                  display={navSize === 'small' ? 'none' : 'flex'}
                >
                  {title}
                </Text>
                {externalLink && navSize === 'large' && (
                  <Icon
                    as={FiExternalLink}
                    alignSelf="center"
                    ml={2}
                  />
                )}
              </Flex>
            </MenuButton>
          </Tooltip>
        </ChakraLink>
      </Menu>
    </Flex>
  );
};
