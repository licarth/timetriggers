export const until = (fn: () => boolean, maxWait: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (fn()) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Timeout"));
    }, maxWait);
  });
};
