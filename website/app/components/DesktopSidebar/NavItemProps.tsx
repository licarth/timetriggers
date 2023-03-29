import type { As } from '@chakra-ui/react';
import type { UserPrefs } from '@timetriggers/domain';

export type NavSize = UserPrefs['initialNavSize'];

export type NavItemProps = {
  navSize: NavSize;
  title: string;
  icon: As<any>;
  active?: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  href?: string;
  externalLink?: boolean;
};
