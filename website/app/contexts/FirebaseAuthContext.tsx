import type { User } from "@firebase/auth";
import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as sendPasswordResetEmailFirebase,
  reload,
} from "@firebase/auth";
import * as React from "react";
// import { FullStoryAPI } from "react-fullstory";
import { initializeFirebaseWeb } from "../initializeFirebaseWeb";

const provider = new GoogleAuthProvider();

type UserState = "loading" | User | null;

type ContextState = {
  user: UserState;
};

const FirebaseAuthContext = React.createContext<ContextState | undefined>(
  undefined
);

const FirebaseAuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [user, setUser] = React.useState<UserState>("loading");

  React.useEffect(() => {
    const auth = initializeFirebaseWeb().auth;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !user.isAnonymous) {
        // FullStoryAPI("identify", user.uid, {
        //   email: user.email || undefined,
        //   displayName: user.displayName || undefined,
        // });
        // sendIdTokenToServer({ user });
      }
      setUser(user);
    });
    return unsubscribe;
  }, []);

  return (
    <FirebaseAuthContext.Provider value={{ user }}>
      {children}
    </FirebaseAuthContext.Provider>
  );
};

const sendIdTokenToServer = async ({ user }: { user: User }) => {
  return user.getIdToken().then((idToken) => {
    return fetch("/session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  });
};

type SendPasswordResetEmail = (args: { email: string }) => Promise<void>;

type UseFirebaseAuth = {
  user: User | null;
  reloadUserData: () => Promise<void>;
  googleSignIn: () => void;
  anonymousSignIn: () => void;
  emailPasswordSignIn: (args: {
    email: string;
    password: string;
  }) => Promise<void>;
  sendPasswordResetEmail: SendPasswordResetEmail;
  signOut: () => Promise<void>;
  loading: boolean;
};

function useFirebaseAuth(): UseFirebaseAuth {
  const auth = initializeFirebaseWeb().auth;
  const context = React.useContext(FirebaseAuthContext);
  if (context === undefined) {
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider"
    );
  }

  const reloadUserData = () => {
    if (auth.currentUser) {
      return auth.currentUser.getIdTokenResult(true);
    } else {
      throw new Error("Cannot reload user data when user is not logged in");
    }
  };

  const emailPasswordSignIn = ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) =>
    signInWithEmailAndPassword(auth, email, password)
      .then(sendIdTokenToServer)
      .then(() => {});

  const sendPasswordResetEmail: SendPasswordResetEmail = ({ email }) =>
    sendPasswordResetEmailFirebase(auth, email);

  const anonymousSignIn = () =>
    signInAnonymously(auth)
      .then(sendIdTokenToServer)
      .catch((error) => {
        // const errorCode = error.code;
        // const errorMessage = error.message;
        // TODO deal with errors
      });

  const googleSignIn = () => {
    signInWithPopup(auth, provider)
      .then(sendIdTokenToServer)
      .catch((error) => {
        // // Handle Errors here.
        // const errorCode = error.code;
        // const errorMessage = error.message;
        // // The email of the user's account used.
        // const email = error.email;
        // // The AuthCredential type that was used.
        // const credential = GoogleAuthProvider.credentialFromError(error);
        // // ...
      });
  };

  const loading = context.user === "loading";
  return {
    user: loading ? null : (context.user as User),
    reloadUserData,
    anonymousSignIn,
    googleSignIn,
    emailPasswordSignIn,
    sendPasswordResetEmail,
    signOut: () =>
      signOut(auth)
        .then(async () => await fetch("/logout"))
        .then(() => {}),
    loading,
  };
}

export { FirebaseAuthProvider, useFirebaseAuth };
