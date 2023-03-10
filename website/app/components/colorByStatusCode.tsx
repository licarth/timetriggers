export const colorByStatusCode = (statusCode: number) => {
  if (statusCode >= 200 && statusCode < 300) {
    return 'green';
  }
  if (statusCode >= 300 && statusCode < 400) {
    return 'blue';
  }
  if (statusCode >= 400 && statusCode < 500) {
    return 'yellow';
  }
  if (statusCode >= 500 && statusCode < 600) {
    return 'red';
  }
  return 'gray';
};
