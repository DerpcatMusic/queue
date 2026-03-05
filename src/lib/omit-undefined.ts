type DefinedProps<T extends Record<string, unknown>> = {
  [K in keyof T]?: Exclude<T[K], undefined>;
};

export function omitUndefined<T extends Record<string, unknown>>(value: T): DefinedProps<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as DefinedProps<T>;
}
