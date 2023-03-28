import type { As } from '@chakra-ui/react';

export type NavSize = 'small' | 'large';

export type NavItemProps = {
  navSize: NavSize;
  title: string;
  icon: As<any>;
  active?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  href?: string;
};
