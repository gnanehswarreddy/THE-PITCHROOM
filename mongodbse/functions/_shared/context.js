export const json = (status, body) => ({ status, body });

export const notImplemented = (name) =>
  json(501, {
    error: `${name} is not implemented yet for MongoDB`,
    data: null,
  });
