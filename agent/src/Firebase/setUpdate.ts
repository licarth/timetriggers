import _ from "lodash";

export const setUpdate = (update: { [key: string]: any }) => {
  return _.keys(update).reduce(
    (prev, currKey) => _.setWith(prev, currKey, update[currKey], Object),
    {}
  );
};
