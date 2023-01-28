export const environmentVariable = (
  variableName: string
): string | undefined => {
  if (typeof process !== "undefined") {
    return process.env[variableName];
  } else if (typeof window !== "undefined")
    // @ts-ignore
    return window.ENV[variableName];
  else return undefined;
};
