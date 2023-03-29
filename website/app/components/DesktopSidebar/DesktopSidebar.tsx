import { Flex } from '@chakra-ui/react';
import { useLocation } from '@remix-run/react';
import type {
  FirebaseUser,
  MonthlyUsage,
  Project,
} from '@timetriggers/domain';
import { useEffect, useState } from 'react';
import { MenuElements } from './MenuEl';
import type { NavSize } from './NavItemProps';
import { SidebarBottom } from './SidebarBottom';

type SidebarProps = {
  user?: FirebaseUser;
  projects?: Project[];
  projectMonthlyUsage?: MonthlyUsage;
  initialNavSize?: NavSize;
};

export const DesktopSidebar = ({
  user,
  projects,
  projectMonthlyUsage,
  initialNavSize = 'large',
}: SidebarProps) => {
  const { pathname } = useLocation();
  const [screenWidth, setScreenWidth] = useState<number>();

  useEffect(() => {
    typeof window !== 'undefined' &&
      setScreenWidth(window.innerWidth);
  }, []);

  const [navSize, setNavSizeState] =
    useState<NavSize>(initialNavSize);

  const setNavSize = (navSize: NavSize) => {
    setNavSizeState(navSize);
    // Save in Cookies
    fetch('/api/user-prefs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ initialNavSize: navSize }),
    });
  };

  useEffect(() => {
    // If the screen is too small, set navSize to small
    if (screenWidth && screenWidth < 768) {
      setNavSize('small');
    }
  }, [screenWidth]);

  const selectedProjectSlug = pathname.startsWith('/projects/')
    ? pathname.split('/')[2]
    : undefined;

  return (
    <Flex
      pos="sticky"
      direction="column"
      top="0"
      maxW={'fit-content'}
      flexGrow={1}
      justifyContent={'space-between'}
      boxShadow="0 4px 12px 0 rgba(0,0,0,0.5)"
      display={{ base: 'none', sm: 'flex' }}
    >
      <MenuElements
        user={user}
        projects={projects}
        selectedProjectSlug={selectedProjectSlug}
        navSize={navSize}
        setNavSize={setNavSize}
        projectMonthlyUsage={projectMonthlyUsage}
      />
      <SidebarBottom navSize={navSize} />
    </Flex>
  );
};
