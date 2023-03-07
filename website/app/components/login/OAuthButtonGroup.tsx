import { Button, ButtonGroup, VisuallyHidden } from "@chakra-ui/react";
import { useNavigate } from "@remix-run/react";
import { useFirebaseAuth } from "~/contexts";
import { GitHubIcon, GoogleIcon } from "./ProviderIcons";

export const OAuthButtonGroup = ({
  setLoading,
}: {
  setLoading: (loading: boolean) => void;
}) => {
  const navigate = useNavigate();

  const { googleSignIn, githubSignIn } = useFirebaseAuth();
  const providers = [
    {
      name: "Google",
      icon: <GoogleIcon boxSize="5" />,
      action: async () => {
        setLoading(true);
        await googleSignIn();
        navigate("/projects");
      },
    },
    {
      name: "GitHub",
      icon: <GitHubIcon boxSize="5" />,
      action: async () => {
        setLoading(true);
        await githubSignIn();
        navigate("/projects");
      },
    },
  ];
  return (
    <ButtonGroup variant="outline" spacing="4" width="full">
      {providers.map(({ name, icon, action }) => (
        <Button key={name} width="full" onClick={() => action && action()}>
          <VisuallyHidden>Sign in with {name}</VisuallyHidden>
          {icon}
        </Button>
      ))}
    </ButtonGroup>
  );
};
